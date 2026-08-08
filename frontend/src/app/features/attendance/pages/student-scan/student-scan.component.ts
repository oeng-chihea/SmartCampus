import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { AuthService } from '../../../../services/auth.service';
import { OpenLiveSessionCard } from '../../../../models/session.model';
import { StudentScanPageFlow } from './student-scan.flow';
import { StudentScanPageState } from './student-scan.state';

const CAMERA_REGION_ID = 'student-scan-camera-region';

/**
 * Student attendance page.
 * Mark present via button, iPhone Camera deep link, or in-app camera scan.
 */
@Component({
  selector: 'app-student-scan',
  imports: [DatePipe],
  templateUrl: './student-scan.component.html',
  styleUrl: './student-scan.component.scss',
  providers: [StudentScanPageState, StudentScanPageFlow],
})
export class StudentScanComponent implements OnInit, OnDestroy {
  readonly state = inject(StudentScanPageState);
  private readonly flow = inject(StudentScanPageFlow);
  private readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.user());
  readonly cameraRegionId = CAMERA_REGION_ID;

  @ViewChild('cameraHost') cameraHost?: ElementRef<HTMLDivElement>;

  private scanner: Html5Qrcode | null = null;
  private scanBusy = false;

  async ngOnInit(): Promise<void> {
    await this.flow.init();
  }

  ngOnDestroy(): void {
    void this.stopCamera(false);
    this.flow.destroy();
  }

  refresh(): Promise<void> {
    return this.flow.reload(true);
  }

  markPresent(session: OpenLiveSessionCard): Promise<void> {
    return this.flow.markPresent(session);
  }

  alreadyDone(sessionTitle: string): boolean {
    return this.state.hasSubmittedFor(sessionTitle);
  }

  logout(): void {
    void this.stopCamera(false);
    this.flow.logout();
  }

  async toggleCamera(): Promise<void> {
    if (this.state.cameraOpen()) {
      await this.stopCamera(true);
      return;
    }
    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    this.state.openCamera();
    // Wait a tick so the camera region is in the DOM.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'This browser cannot use the camera. Open Smart Campus in Safari on your iPhone, or use the Mark me present button.',
        );
      }

      this.scanner = new Html5Qrcode(CAMERA_REGION_ID);
      await this.scanner.start(
        { facingMode: 'environment' },
        {
          fps: 8,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        (decoded) => {
          void this.onDecoded(decoded);
        },
        () => {
          // Ignore per-frame "not found" noise.
        },
      );
    } catch (error) {
      await this.stopCamera(false);
      this.state.closeCamera();
      this.state.setCameraError(this.mapCameraError(error));
    }
  }

  private async onDecoded(decoded: string): Promise<void> {
    if (this.scanBusy || this.state.submittingId()) {
      return;
    }
    this.scanBusy = true;
    try {
      const ok = await this.flow.submitScannedText(decoded);
      if (ok) {
        await this.stopCamera(true);
      }
    } finally {
      this.scanBusy = false;
    }
  }

  private async stopCamera(updateState: boolean): Promise<void> {
    const active = this.scanner;
    this.scanner = null;
    if (active) {
      try {
        if (active.isScanning) {
          await active.stop();
        }
        active.clear();
      } catch {
        // Scanner may already be stopped.
      }
    }
    if (updateState) {
      this.state.closeCamera();
    }
  }

  private mapCameraError(error: unknown): string {
    const message =
      error instanceof Error ? error.message : String(error ?? '');
    const lower = message.toLowerCase();

    if (
      lower.includes('permission') ||
      lower.includes('notallowed') ||
      lower.includes('denied')
    ) {
      return 'Camera permission denied. Allow camera access in Safari settings, then try again.';
    }
    if (
      lower.includes('secure') ||
      lower.includes('https') ||
      lower.includes('getusermedia')
    ) {
      return 'Camera needs a secure page (HTTPS or localhost). Prefer scanning the teacher QR with the iPhone Camera app, or use Mark me present.';
    }
    if (message.trim()) {
      return message;
    }
    return 'Could not start the camera. Use the iPhone Camera app on the teacher QR, or tap Mark me present.';
  }
}
