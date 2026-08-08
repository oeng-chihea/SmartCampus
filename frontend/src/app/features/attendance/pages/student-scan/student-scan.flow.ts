import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';
import {
  buildAttendanceScanUrl,
  extractAttendancePayload,
  sessionIdFromPayload,
} from '../../../../core/utils/qr-scan.util';
import { AuthService } from '../../../../services/auth.service';
import { StudentAttendanceService } from '../../../../services/student-attendance.service';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageState } from './student-scan.state';

const POLL_MS = 12_000;

/**
 * Student attendance flow:
 * load open sessions (same live QR as teacher) → mark present
 * OR submit payload from iPhone Camera deep link / in-app camera scan.
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

  async init(): Promise<void> {
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

      const cards: OpenLiveSessionCard[] = await Promise.all(
        open.map(async (session) => ({
          ...session,
          // Same deep-link URL the teacher QR encodes (Camera-friendly).
          qrDataUrl: await QRCode.toDataURL(
            buildAttendanceScanUrl(session.qr.payload),
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
      if (!this.state.lastRecord() && mine.length > 0) {
        this.state.lastRecord.set(mine[0]);
      }
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

  async markPresent(session: OpenLiveSessionCard): Promise<void> {
    if (this.state.hasSubmittedFor(session.title)) {
      this.state.alreadySubmitted(this.state.recordForSession(session.title));
      return;
    }

    this.state.beginSubmit(session.id);
    try {
      // Refresh once so we use the latest live QR token if it just rotated.
      await this.reload(false);
      const live =
        this.state.openSessions().find((row) => row.id === session.id) ?? session;

      const record = await this.attendance.submit({
        payload: live.qr.payload,
      });
      this.state.submitSucceeded(record);
      await this.reload(false);
    } catch (error) {
      if (this.attendance.isConflict(error)) {
        await this.reload(false);
        this.state.alreadySubmitted(this.state.recordForSession(session.title));
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

  /**
   * Submit a payload from the iPhone Camera deep link or in-app scanner.
   * Accepts raw SMARTCAMPUS|… or a full scan URL containing ?payload=.
   */
  async submitScannedText(scanned: string): Promise<boolean> {
    const payload = extractAttendancePayload(scanned);
    if (!payload) {
      this.state.setError(
        'That QR is not a Smart Campus attendance code. Point at the teacher’s live QR.',
      );
      return false;
    }

    return this.submitRawPayload(payload, 'camera');
  }

  logout(): void {
    this.stopPolling();
    const role = this.auth.role();
    this.auth.logout();
    void this.router.navigateByUrl(this.auth.loginPathForRole(role));
  }

  destroy(): void {
    this.stopPolling();
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

    this.state.setInfo('QR link detected — recording your attendance…');
    const ok = await this.submitRawPayload(payload, 'deeplink');
    this.clearPayloadFromUrl();
    if (ok) {
      this.state.setInfo(null);
    }
  }

  private async submitRawPayload(
    payload: string,
    source: 'camera' | 'deeplink',
  ): Promise<boolean> {
    const sessionId = sessionIdFromPayload(payload) ?? source;
    this.state.beginSubmit(sessionId);
    try {
      const record = await this.attendance.submit({ payload });
      this.state.submitSucceeded(record);
      await this.reload(false);
      return true;
    } catch (error) {
      if (this.attendance.isConflict(error)) {
        await this.reload(false);
        // Best effort: open-session card title if we still have this session.
        const open = this.state
          .openSessions()
          .find((row) => row.id === sessionId);
        const match =
          (open ? this.state.recordForSession(open.title) : null) ??
          this.state.lastRecord() ??
          this.state.myRecords()[0] ??
          null;
        this.state.alreadySubmitted(match);
        return true;
      }
      if (sessionId !== source && this.attendance.isQrRejected(error)) {
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

    try {
      const record = await this.attendance.submit({
        payload: live.qr.payload,
      });
      this.state.submitSucceeded(record);
      await this.reload(false);
      return true;
    } catch {
      return false;
    }
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
