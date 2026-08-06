import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { AuthService } from '../../../../services/auth.service';
import { StudentAttendanceService } from '../../../../services/student-attendance.service';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageState } from './student-scan.state';

const POLL_MS = 12_000;

/**
 * Student attendance flow:
 * load open sessions (same live QR as teacher) → mark present.
 */
@Injectable()
export class StudentScanPageFlow {
  private readonly state = inject(StudentScanPageState);
  private readonly attendance = inject(StudentAttendanceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async init(): Promise<void> {
    await this.reload(true);
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
          qrDataUrl: await QRCode.toDataURL(session.qr.payload, {
            width: 220,
            margin: 2,
            color: { dark: '#14532d', light: '#ffffff' },
          }),
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

  logout(): void {
    this.stopPolling();
    const role = this.auth.role();
    this.auth.logout();
    void this.router.navigateByUrl(this.auth.loginPathForRole(role));
  }

  destroy(): void {
    this.stopPolling();
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
