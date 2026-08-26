import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';
import {
  formatSessionDue,
  isSessionPastDue,
} from '../../../../core/utils/date.util';
import {
  DeviceCoordinates,
  GeolocationFailureReason,
  getCurrentCoordinates,
  watchDeviceLocation,
} from '../../../../core/utils/geolocation.util';
import {
  buildAttendanceScanUrl,
  extractAttendancePayload,
  sessionIdFromPayload,
} from '../../../../core/utils/qr-scan.util';
import { SubmitAttendanceRequest } from '../../../../models/attendance.model';
import { AuthService } from '../../../../services/auth.service';
import { ScanOriginService } from '../../../../services/scan-origin.service';
import { StudentAttendanceService } from '../../../../services/student-attendance.service';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageState } from './student-scan.state';

const POLL_MS = 12_000;

/**
 * Student attendance flow:
 * load open sessions (same live QR as teacher) → mark present
 * OR submit payload from the teacher-QR deep link (iPhone Camera app).
 *
 * Past-due sessions stay visible until the teacher closes them; mark/scan
 * is blocked with a confirm dialog instead of removing the card.
 */
@Injectable()
export class StudentScanPageFlow {
  private readonly state = inject(StudentScanPageState);
  private readonly attendance = inject(StudentAttendanceService);
  private readonly scanOrigin = inject(ScanOriginService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private deepLinkHandled = false;
  private stopWatching: (() => void) | null = null;

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
      const origin = await this.scanOrigin.resolve();
      const cards: OpenLiveSessionCard[] = await Promise.all(
        open.map(async (session) => ({
          ...session,
          // Same public HTTPS URL the teacher QR encodes (Camera-friendly).
          qrDataUrl: await QRCode.toDataURL(
            buildAttendanceScanUrl(session.qr.payload, origin),
            {
              width: 220,
              margin: 2,
              color: { dark: '#14532d', light: '#ffffff' },
            },
          ),
        })),
      );

      this.state.setOpenSessions(cards);
      this.state.setHistory(mine);
    } catch (error) {
      this.state.setError(
        this.attendance.mapError(
          error,
          'Could not load open class sessions from the API.',
        ),
      );
    } finally {
      if (showLoading) {
        this.state.endLoad();
      }
    }
  }

  async markPresent(
    session: OpenLiveSessionCard,
    options?: { reload?: boolean },
  ): Promise<void> {
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
      const live =
        this.state.openSessions().find((row) => row.id === session.id) ?? session;

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
          this.attendance.mapError(
            error,
            'Could not mark attendance. Refresh and try again.',
          ),
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

  /** After login / open from Camera: ?payload=SMARTCAMPUS|… */
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
        'This scan link is invalid or expired. Ask your teacher to show a fresh QR.',
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

    this.state.setInfo('QR link detected — recording your attendance…');
    const ok = await this.submitRawPayload(payload);
    this.clearPayloadFromUrl();
    if (ok) {
      this.state.setInfo(null);
    }
  }

  private async submitRawPayload(payload: string): Promise<boolean> {
    const sessionId = sessionIdFromPayload(payload) ?? 'deeplink';
    const sessionTitle =
      this.state.openSessions().find((row) => row.id === sessionId)?.title ??
      'this session';
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
        // Best effort: open-session card title if we still have this session.
        const open = this.state
          .openSessions()
          .find((row) => row.id === sessionId);
        const match =
          (open ? this.state.recordForSession(open.id) : null) ??
          this.state.myRecords()[0] ??
          null;
        this.state.alreadySubmitted(match);
        return true;
      }
      if (this.isDueTimeRejected(error)) {
        const open = this.state
          .openSessions()
          .find((row) => row.id === sessionId);
        this.state.openDueBlocked({
          sessionTitle: open?.title ?? 'this session',
          dueAt: open?.dueAt ?? null,
          fromScan: true,
        });
        this.state.setInfo(null);
        return false;
      }
      if (sessionId !== 'deeplink' && this.attendance.isQrRejected(error)) {
        // Scanned token rotated/expired (or session just closed) — retry once
        // with the current live token from the API before surfacing an error.
        const fresh = await this.submitWithFreshPayload(sessionId);
        if (fresh) {
          return true;
        }
      }
      this.state.setError(
        this.attendance.mapError(
          error,
          'Could not mark attendance from this QR. Ask for a fresh code and try again.',
        ),
      );
      return false;
    } finally {
      this.state.endSubmit();
    }
  }

  /** Retry with the API's current live QR token for the same session. */
  private async submitWithFreshPayload(sessionId: string): Promise<boolean> {
    const findLive = (): OpenLiveSessionCard | null =>
      this.state.openSessions().find((row) => row.id === sessionId) ?? null;

    let live = findLive();
    if (!live) {
      try {
        await this.reload(false);
      } catch {
        return false;
      }
      live = findLive();
    }
    if (!live) {
      return false;
    }

    if (isSessionPastDue(live.dueAt)) {
      this.state.openDueBlocked({
        sessionTitle: live.title,
        dueAt: live.dueAt,
        fromScan: true,
      });
      this.state.setInfo(null);
      return false;
    }

    const request = await this.buildSubmitRequest(live.qr.payload, live.title, async () => {
      await this.submitWithFreshPayload(sessionId);
    });
    if (!request) {
      // Location denied/unavailable — notice shown, nothing submitted (FR-02).
      return false;
    }

    try {
      const record = await this.attendance.submit(request);
      this.state.submitSucceeded(record);
      void this.reload(false);
      return true;
    } catch (error) {
      if (this.isDueTimeRejected(error)) {
        this.state.openDueBlocked({
          sessionTitle: live.title,
          dueAt: live.dueAt,
          fromScan: true,
        });
        this.state.setInfo(null);
      }
      return false;
    }
  }

  /**
   * Reads a device GPS fix for the submit payload. FR-02 hard gate: when
   * geolocation is denied/unsupported/times out, nothing is submitted —
   * a "location needed" notice opens with a `retry` callback.
   * A live watch reading is used immediately so the student is not delayed.
   */
  private async buildSubmitRequest(
    payload: string,
    sessionTitle: string,
    retry: () => Promise<void>,
  ): Promise<SubmitAttendanceRequest | null> {
    const live = this.state.deviceFix();
    if (live) {
      return requestFromFix(payload, live);
    }

    const reading = await getCurrentCoordinates();
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

  private clearPayloadFromUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { payload: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.reload(false);
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
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

export function dueBlockedDetail(
  sessionTitle: string,
  dueAt: string | null,
): string {
  const dueLabel = formatSessionDue(dueAt);
  if (dueLabel === '—') {
    return `Session: ${sessionTitle}`;
  }
  return `Session: ${sessionTitle} · Due ${dueLabel}`;
}

/** Message used by the location-blocked confirm dialog (FR-02 hard gate). */
export const LOCATION_BLOCKED_MESSAGE =
  'Location access is required to mark attendance. Please allow location access in your browser and try again.';

export function locationBlockedMessage(reason: GeolocationFailureReason): string {
  switch (reason) {
    case 'insecure':
      return 'This page is not HTTPS. Open the teacher QR HTTPS link — Safari cannot use GPS on a plain http:// page.';
    case 'timeout':
    case 'unavailable':
      return 'Could not read GPS. Keep Location on for Safari, wait a moment, then try again.';
    case 'unsupported':
      return 'This browser cannot read location. Open the scan link in Safari and try again.';
    case 'denied':
    default:
      return LOCATION_BLOCKED_MESSAGE;
  }
}

export function locationBlockedDetail(sessionTitle: string): string {
  return `Session: ${sessionTitle}`;
}

function requestFromFix(
  payload: string,
  fix: DeviceCoordinates,
): SubmitAttendanceRequest {
  return {
    payload,
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracyMeters: fix.accuracyMeters ?? undefined,
  };
}
