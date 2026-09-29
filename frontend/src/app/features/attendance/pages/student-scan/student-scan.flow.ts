import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { formatSessionDue, isSessionPastDue } from '../../../../core/utils/date.util';
import {
  DeviceCoordinates,
  GeolocationFailureReason,
  getCurrentCoordinates,
  watchDeviceLocation,
} from '../../../../core/utils/geolocation.util';
import {
  extractAttendancePayload,
  sessionIdFromPayload,
} from '../../../../core/utils/qr-scan.util';
import { SubmitAttendanceRequest } from '../../../../models/attendance.model';
import { AuthService } from '../../../../services/auth.service';
import { StudentAttendanceService } from '../../../../services/student-attendance.service';
import { OpenLiveSession, OpenLiveSessionCard } from '../../../../models/session.model';
import { ScanSubmitResult } from '../../../../shared/components/qr-scanner-dialog/qr-scanner-dialog.model';
import { StudentScanPageState } from './student-scan.state';

const POLL_MS = 12_000;
const SUBMIT_LOCATION_TIMEOUT_MS = 15_000;
const RECENT_DEVICE_FIX_MAX_AGE_MS = 30_000;

/**
 * Student attendance flow:
 * load open sessions → wait for an explicit student action to mark present.
 *
 * Past-due sessions stay visible until the teacher closes them; marking
 * is blocked with a confirm dialog instead of removing the card.
 */
@Injectable()
export class StudentScanPageFlow {
  private readonly state = inject(StudentScanPageState);
  private readonly attendance = inject(StudentAttendanceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private deepLinkHandled = false;
  private stopWatching: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private readonly qrDataUrlCache = new Map<string, string>();

  async init(): Promise<void> {
    this.startLocationWatch();
    await this.reload(true);
    await this.trySubmitDeepLinkPayload();
    this.startPolling();
  }

  async reload(showLoading = false): Promise<void> {
    if (showLoading) {
      this.state.beginLoad();
    }
    try {
      const [open, mine] = await Promise.all([
        this.attendance.listOpenSessions(),
        this.attendance.listMine().catch(() => []),
      ]);

      // Keep all open sessions (including past due). Closed sessions leave the
      // open list on the API after the teacher closes them.
      const cards: OpenLiveSessionCard[] = await Promise.all(
        open.map(async (session) => ({
          ...session,
          // Encode only the temporary attendance payload; no camera deep-link URL is generated.
          qrDataUrl: await this.qrDataUrlFor(session.qr.payload),
        })),
      );

      this.pruneQrDataUrlCache(open);
      this.state.setOpenSessions(cards);
      this.state.setHistory(mine);
    } catch (error) {
      this.state.setError(
        this.attendance.mapError(error, 'Could not load open class sessions from the API.'),
      );
    } finally {
      if (showLoading) {
        this.state.endLoad();
      }
    }
  }

  async markPresent(session: OpenLiveSessionCard, options?: { reload?: boolean }): Promise<void> {
    if (this.state.hasSubmittedFor(session.id)) {
      this.state.alreadySubmitted(this.state.recordForSession(session.id));
      return;
    }

    if (isSessionPastDue(session.dueAt)) {
      this.state.openDueBlocked({
        sessionTitle: session.title,
        dueAt: session.dueAt,
        fromScan: false,
      });
      return;
    }

    this.state.beginSubmit(session.id);
    try {
      const live = this.state.openSessions().find((row) => row.id === session.id) ?? session;

      if (isSessionPastDue(live.dueAt)) {
        this.state.openDueBlocked({
          sessionTitle: live.title,
          dueAt: live.dueAt,
          fromScan: false,
        });
        return;
      }

      const request = await this.buildSubmitRequest(live.qr.payload, live.title, () =>
        this.markPresent(session, options),
      );
      if (!request) {
        // Location denied/unavailable — notice shown, nothing submitted (FR-02).
        return;
      }

      const record = await this.attendance.submit(request);
      this.state.submitSucceeded(record);
      if (options?.reload !== false) {
        void this.reload(false);
      }
    } catch (error) {
      if (this.attendance.isConflict(error)) {
        await this.reload(false);
        this.state.alreadySubmitted(this.state.recordForSession(session.id));
      } else if (this.isDueTimeRejected(error)) {
        this.state.openDueBlocked({
          sessionTitle: session.title,
          dueAt: session.dueAt,
          fromScan: false,
        });
      } else {
        this.state.setError(
          this.attendance.mapError(error, 'Could not mark attendance. Refresh and try again.'),
        );
      }
    } finally {
      this.state.endSubmit();
    }
  }

  dismissDueBlocked(): void {
    this.state.closeDueBlocked();
  }

  logout(): void {
    this.stopPolling();
    this.stopLocationWatch();
    const role = this.auth.role();
    this.auth.logout();
    void this.router.navigateByUrl(this.auth.loginPathForRole(role));
  }

  destroy(): void {
    this.stopPolling();
    this.stopLocationWatch();
    this.qrDataUrlCache.clear();
  }

  private startLocationWatch(): void {
    this.stopLocationWatch();
    this.stopWatching = watchDeviceLocation((result) => {
      if (result.ok) {
        this.state.setDeviceFix(result.coords);
        return;
      }
      this.state.setDeviceFixFailed(result.reason);
    });
  }

  private stopLocationWatch(): void {
    this.stopWatching?.();
    this.stopWatching = null;
  }

  async processScannedQr(scannedText: string): Promise<ScanSubmitResult> {
    const payload = extractAttendancePayload(scannedText);
    if (!payload) {
      return {
        status: 'invalid-qr',
        message:
          'That QR is not a valid Smart Campus attendance code. Point your camera at the teacher’s live QR.',
      };
    }

    const sessionId = sessionIdFromPayload(payload);
    const live = sessionId
      ? (this.state.openSessions().find((row) => row.id === sessionId) ?? null)
      : null;
    const sessionTitle = live?.title ?? 'Class Session';

    if (live && isSessionPastDue(live.dueAt)) {
      return {
        status: 'due-blocked',
        sessionTitle,
        dueAt: live.dueAt,
        message: 'You cannot mark present from this QR code. The session due time has passed.',
      };
    }

    // Geolocation verification (FR-02 hard gate)
    const recentFix = this.state.deviceFix();
    let fix: DeviceCoordinates | null = isRecentDeviceFix(recentFix) ? recentFix : null;
    if (!fix) {
      const reading = await getCurrentCoordinates(SUBMIT_LOCATION_TIMEOUT_MS);
      if (!reading.ok) {
        return {
          status: 'location-blocked',
          sessionTitle,
          reason: reading.reason,
          message: locationBlockedMessage(reading.reason),
        };
      }
      this.state.setDeviceFix(reading.coords);
      fix = reading.coords;
    }

    this.state.beginSubmit(sessionId ?? 'scan');
    try {
      const request = requestFromFix(payload, fix);
      const record = await this.attendance.submit(request);
      const resolvedSessionTitle = record.session?.trim() || sessionTitle;
      this.state.submitSucceeded(record);
      void this.reload(false);
      return {
        status: 'success',
        sessionTitle: resolvedSessionTitle,
        attendanceStatus: record.attendanceStatus ?? 'PRESENT',
        record,
        message: `Your attendance for ${resolvedSessionTitle} has been recorded as Present.`,
      };
    } catch (error) {
      if (this.attendance.isConflict(error)) {
        await this.reload(false);
        const match = sessionId ? this.state.recordForSession(sessionId) : null;
        const resolvedSessionTitle = match?.session?.trim() || sessionTitle;
        this.state.alreadySubmitted(match);
        return {
          status: 'success',
          sessionTitle: resolvedSessionTitle,
          attendanceStatus: match?.attendanceStatus ?? 'PRESENT',
          record: match,
          message: `You have already marked attendance for ${resolvedSessionTitle}.`,
        };
      }
      if (this.isDueTimeRejected(error)) {
        return {
          status: 'due-blocked',
          sessionTitle,
          dueAt: live?.dueAt ?? null,
          message: 'You cannot mark present from this QR code. The session due time has passed.',
        };
      }
      const errMsg = this.attendance.mapError(
        error,
        'Could not mark attendance from this code. Ask for a fresh code and try again.',
      );
      return {
        status: 'error',
        message: errMsg,
      };
    } finally {
      this.state.endSubmit();
    }
  }

  /**
   * Submit an attendance QR payload scanned via the in-app camera scanner.
   * Accepts raw SMARTCAMPUS|sessionId|token (or legacy URL with ?payload=).
   */
  async submitScannedQr(scannedText: string): Promise<boolean> {
    const result = await this.processScannedQr(scannedText);
    if (result.status === 'success') {
      return true;
    }
    if (result.status === 'location-blocked') {
      this.state.openLocationBlocked({
        sessionTitle: result.sessionTitle,
        reason: result.reason,
        retry: async () => {
          await this.submitScannedQr(scannedText);
        },
      });
      return false;
    }
    if (result.status === 'due-blocked') {
      this.state.openDueBlocked({
        sessionTitle: result.sessionTitle,
        dueAt: result.dueAt ?? null,
        fromScan: true,
      });
      return false;
    }
    if (result.status === 'invalid-qr' || result.status === 'error') {
      this.state.setError(result.message);
      return false;
    }
    return false;
  }

  /** Accept an existing temporary attendance payload link without generating new links. */
  private async trySubmitDeepLinkPayload(): Promise<void> {
    if (this.deepLinkHandled) {
      return;
    }
    const raw = this.route.snapshot.queryParamMap.get('payload');
    if (!raw) {
      return;
    }
    this.deepLinkHandled = true;

    const payload = extractAttendancePayload(raw);
    if (!payload) {
      this.state.setError(
        'This attendance link is invalid or expired. Ask your teacher to show a fresh code.',
      );
      this.clearPayloadFromUrl();
      return;
    }

    const sessionId = sessionIdFromPayload(payload);
    if (sessionId) {
      const live = this.state.openSessions().find((row) => row.id === sessionId);
      if (live && isSessionPastDue(live.dueAt)) {
        this.state.openDueBlocked({
          sessionTitle: live.title,
          dueAt: live.dueAt,
          fromScan: true,
        });
        this.clearPayloadFromUrl();
        return;
      }
    }

    this.state.setInfo('Attendance code detected — recording your attendance…');
    const ok = await this.submitRawPayload(payload);
    this.clearPayloadFromUrl();
    if (ok) {
      this.state.setInfo(null);
    }
  }

  private async submitRawPayload(payload: string): Promise<boolean> {
    const sessionId = sessionIdFromPayload(payload) ?? 'deeplink';
    const sessionTitle =
      this.state.openSessions().find((row) => row.id === sessionId)?.title ?? 'this session';
    this.state.beginSubmit(sessionId);
    try {
      const request = await this.buildSubmitRequest(payload, sessionTitle, async () => {
        await this.submitRawPayload(payload);
      });
      if (!request) {
        // Location denied/unavailable — notice shown, nothing submitted (FR-02).
        return false;
      }

      const record = await this.attendance.submit(request);
      this.state.submitSucceeded(record);
      void this.reload(false);
      return true;
    } catch (error) {
      if (this.attendance.isConflict(error)) {
        await this.reload(false);
        const open = this.state.openSessions().find((row) => row.id === sessionId);
        const match =
          (open ? this.state.recordForSession(open.id) : null) ?? this.state.myRecords()[0] ?? null;
        this.state.alreadySubmitted(match);
        return true;
      }
      if (this.isDueTimeRejected(error)) {
        const open = this.state.openSessions().find((row) => row.id === sessionId);
        this.state.openDueBlocked({
          sessionTitle: open?.title ?? 'this session',
          dueAt: open?.dueAt ?? null,
          fromScan: true,
        });
        this.state.setInfo(null);
        return false;
      }
      this.state.setError(
        this.attendance.mapError(
          error,
          'Could not mark attendance from this code. Ask for a fresh code and try again.',
        ),
      );
      return false;
    } finally {
      this.state.endSubmit();
    }
  }

  /**
   * Uses a recent live GPS fix when available; otherwise reads a fresh device
   * position. FR-02 hard gate:
   * when geolocation is denied/unsupported/times out, nothing is submitted —
   * a "location needed" notice opens with a `retry` callback.
   *
   * A live fix is only reused while it is timestamped, valid, and no more than
   * 30 seconds old, so the submit cannot silently use stale preview data.
   */
  private async buildSubmitRequest(
    payload: string,
    sessionTitle: string,
    retry: () => Promise<void>,
  ): Promise<SubmitAttendanceRequest | null> {
    const recentFix = this.state.deviceFix();
    if (isRecentDeviceFix(recentFix)) {
      return requestFromFix(payload, recentFix);
    }

    const reading = await getCurrentCoordinates(SUBMIT_LOCATION_TIMEOUT_MS);
    if (reading.ok) {
      this.state.setDeviceFix(reading.coords);
      return requestFromFix(payload, reading.coords);
    }

    this.state.openLocationBlocked({
      sessionTitle,
      reason: reading.reason,
      retry,
    });
    return null;
  }

  /** "Try again" on the location-blocked dialog — re-runs the same submit attempt. */
  async retryAfterLocationBlocked(): Promise<void> {
    const notice = this.state.locationBlocked();
    this.state.closeLocationBlocked();
    if (notice) {
      await notice.retry();
    }
  }

  dismissLocationBlocked(): void {
    this.state.closeLocationBlocked();
  }

  private isDueTimeRejected(error: unknown): boolean {
    if (!this.attendance.isQrRejected(error)) {
      return false;
    }
    const message = this.attendance.mapError(error, '').toLowerCase();
    return message.includes('due time') || message.includes('due');
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void this.reload(false);
    }, POLL_MS);

    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          void this.reload(false);
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.visibilityHandler = null;
  }

  private clearPayloadFromUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { payload: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private async qrDataUrlFor(payload: string): Promise<string> {
    const cached = this.qrDataUrlCache.get(payload);
    if (cached) {
      return cached;
    }

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 220,
      margin: 2,
      color: { dark: '#14532d', light: '#ffffff' },
    });
    this.qrDataUrlCache.set(payload, qrDataUrl);
    return qrDataUrl;
  }

  private pruneQrDataUrlCache(sessions: OpenLiveSession[]): void {
    const activePayloads = new Set(sessions.map((session) => session.qr.payload));
    for (const payload of this.qrDataUrlCache.keys()) {
      if (!activePayloads.has(payload)) {
        this.qrDataUrlCache.delete(payload);
      }
    }
  }
}

/** Message helpers used by the student-scan template for the due dialog. */
export function dueBlockedMessage(fromScan: boolean): string {
  if (fromScan) {
    return 'You cannot mark present from this QR code. The session due time has passed.';
  }
  return 'You cannot mark present for this session. The due time has passed.';
}

export function dueBlockedDetail(sessionTitle: string, dueAt: string | null): string {
  const dueLabel = formatSessionDue(dueAt);
  if (dueLabel === '—') {
    return `Session: ${sessionTitle}`;
  }
  return `Session: ${sessionTitle} · Due ${dueLabel}`;
}

/** Message used by the location-blocked confirm dialog (FR-02 hard gate). */
export const LOCATION_BLOCKED_MESSAGE =
  'Location access is required to mark attendance. Allow location for this site and try again.';

export function locationBlockedMessage(reason: GeolocationFailureReason): string {
  switch (reason) {
    case 'insecure':
      return 'Location requires a secure HTTPS page. Open this site over HTTPS and try again.';
    case 'timeout':
      return 'Your location took too long to load. Keep Location Services on, wait a moment, then try again.';
    case 'unavailable':
      return 'Your browser could not determine your position. Keep Location Services and Wi-Fi on, then try again.';
    case 'unsupported':
      return 'This browser cannot read your location. Try a supported browser on an HTTPS page.';
    case 'denied':
    default:
      return LOCATION_BLOCKED_MESSAGE;
  }
}

export function locationBlockedDetail(sessionTitle: string): string {
  return `Session: ${sessionTitle}`;
}

function isRecentDeviceFix(fix: DeviceCoordinates | null): fix is DeviceCoordinates {
  const timestampMs = fix?.timestampMs;
  if (
    !fix ||
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude) ||
    fix.latitude < -90 ||
    fix.latitude > 90 ||
    fix.longitude < -180 ||
    fix.longitude > 180 ||
    timestampMs == null ||
    !Number.isFinite(timestampMs)
  ) {
    return false;
  }

  const ageMs = Date.now() - timestampMs;
  return ageMs >= 0 && ageMs <= RECENT_DEVICE_FIX_MAX_AGE_MS;
}

function requestFromFix(payload: string, fix: DeviceCoordinates): SubmitAttendanceRequest {
  return {
    payload,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracyMeters: fix.accuracyMeters ?? undefined,
  };
}
