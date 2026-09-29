import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import jsQR from 'jsqr';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';
import { QrScannerViewState, ScanSubmitResult } from './qr-scanner-dialog.model';

export type CameraStatus =
  'requesting' | 'streaming' | 'denied' | 'unavailable' | 'insecure' | 'error';

/** Minimum interval between QR analysis passes (prevents CPU starvation & UI lag on 60/120Hz displays). */
const SCAN_INTERVAL_MS = 120;

/** Fallback crop fraction used before the reticle has a measurable layout box. */
const CROP_BOX_RATIO = 0.64;

/** Target canvas resolution for cropped QR analysis (high-fidelity 640px to resolve dense 70-character QR codes). */
const ANALYSIS_SIZE = 640;

/**
 * In-browser QR code camera scanner dialog.
 *
 * - Keeps <video> element permanently mounted in DOM to prevent Angular timing race conditions.
 * - Streams rear/environment camera with iOS Safari playsinline & webkit-playsinline support.
 * - Throttles analysis to ~8 checks/sec so video playback & UI animations remain silky smooth.
 * - Region of Interest (ROI) Crop: only analyzes the area aligned inside the visual green reticle,
 *   ignoring peripheral codes outside the target box.
 * - Uses one throttled jsQR pass per frame so native and JavaScript decoders cannot race each other.
 * - Displays in-dialog success confirmation ("Marked as Present" with check icon) and location error guidance.
 */
@Component({
  selector: 'app-qr-scanner-dialog',
  templateUrl: './qr-scanner-dialog.component.html',
  styleUrl: './qr-scanner-dialog.component.scss',
  imports: [ModalDialogComponent],
})
export class QrScannerDialogComponent implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');
  private readonly reticleRef = viewChild<ElementRef<HTMLElement>>('reticleElement');

  /**
   * Optional async processor that verifies location and submits attendance.
   * If provided, the dialog stays open and displays the in-dialog success/location-error states.
   */
  readonly processScan = input<((scannedText: string) => Promise<ScanSubmitResult>) | undefined>(
    undefined,
  );

  /** Emitted when a QR code text is successfully detected by the camera (fallback mode). */
  readonly scanned = output<string>();

  /** Emitted when the user closes or cancels the scanner. */
  readonly cancelled = output<void>();

  /** Emitted when scan and attendance processing completes. */
  readonly completed = output<ScanSubmitResult>();

  readonly viewState = signal<QrScannerViewState>('scanning');
  readonly cameraStatus = signal<CameraStatus>('requesting');
  readonly errorMessage = signal<string | null>(null);
  readonly hasMultipleCameras = signal<boolean>(false);
  readonly facingMode = signal<'environment' | 'user'>('environment');
  readonly scanSuccess = signal<boolean>(false);

  readonly successInfo = signal<{
    sessionTitle: string;
    attendanceStatus: string;
    message: string;
  } | null>(null);

  readonly locationErrorInfo = signal<{
    sessionTitle: string;
    reason?: string;
    message: string;
  } | null>(null);

  readonly generalErrorInfo = signal<{
    title?: string;
    message: string;
  } | null>(null);

  readonly modalTitle = computed(() => {
    switch (this.viewState()) {
      case 'submitting':
        return 'Recording attendance';
      case 'success':
        return 'Attendance recorded';
      case 'location-blocked':
        return 'Location access required';
      case 'error':
        return this.generalErrorInfo()?.title ?? 'Cannot mark attendance';
      case 'scanning':
      default:
        return 'Scan attendance QR';
    }
  });

  readonly modalEyebrow = computed(() => {
    switch (this.viewState()) {
      case 'success':
        return 'Attendance verified';
      case 'location-blocked':
        return 'Location required';
      default:
        return 'Camera scanner';
    }
  });

  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private isDestroyed = false;
  private scanHandled = false;
  private cameraRequestId = 0;
  private scanGeneration = 0;
  private lastScanTimestamp = 0;
  private successTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastScannedPayload: string | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  ngAfterViewInit(): void {
    void this.initCamera();
    void this.checkAvailableCameras();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  cancel(): void {
    this.cleanup();
    this.cancelled.emit();
  }

  closeDialog(): void {
    this.cleanup();
    this.cancelled.emit();
  }

  async retryCamera(): Promise<void> {
    this.errorMessage.set(null);
    this.cameraStatus.set('requesting');
    await this.initCamera();
  }

  async toggleFacingMode(): Promise<void> {
    const nextMode = this.facingMode() === 'environment' ? 'user' : 'environment';
    this.facingMode.set(nextMode);
    this.cameraStatus.set('requesting');
    await this.initCamera();
  }

  async retryLocation(): Promise<void> {
    const processor = this.processScan();
    if (!processor || !this.lastScannedPayload) {
      return;
    }
    this.viewState.set('submitting');
    await this.executeScanProcessing(this.lastScannedPayload, processor);
  }

  async scanAgain(): Promise<void> {
    this.lastScannedPayload = null;
    this.scanHandled = false;
    this.scanSuccess.set(false);
    this.successInfo.set(null);
    this.locationErrorInfo.set(null);
    this.generalErrorInfo.set(null);
    this.viewState.set('scanning');
    this.cameraStatus.set('requesting');
    await this.initCamera();
  }

  private async checkAvailableCameras(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      this.hasMultipleCameras.set(videoInputs.length > 1);
    } catch {
      this.hasMultipleCameras.set(false);
    }
  }

  private async initCamera(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const requestId = ++this.cameraRequestId;

    // Stop any existing stream before opening a new one
    this.stopCameraStream();

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      const isLocalhost =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalhost) {
        this.cameraStatus.set('insecure');
        this.errorMessage.set(
          'Camera access requires a secure HTTPS connection. Please load this page over HTTPS.',
        );
        return;
      }
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.cameraStatus.set('unavailable');
      this.errorMessage.set('Your browser does not support camera video streaming.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: this.facingMode() },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!this.isCurrentCameraRequest(requestId)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.mediaStream = stream;
      this.cameraStatus.set('streaming');

      await this.attachStreamToVideo(requestId);
    } catch (err: unknown) {
      if (!this.isCurrentCameraRequest(requestId)) {
        return;
      }
      this.handleCameraError(err);
    }
  }

  private async attachStreamToVideo(requestId: number): Promise<void> {
    const video = this.videoRef?.()?.nativeElement;
    if (!video || !this.mediaStream) {
      if (this.isCurrentCameraRequest(requestId)) {
        this.handleCameraPlaybackError(new Error('Camera preview element is unavailable.'));
        this.stopCameraStream();
      }
      return;
    }

    const stream = this.mediaStream;

    // Critical for iOS Safari inline WebRTC playback
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;

    video.srcObject = this.mediaStream;

    // Direct playback trigger — avoids iOS Safari onloadedmetadata deadlocks
    try {
      await video.play();
    } catch (error: unknown) {
      if (!this.isCurrentCameraRequest(requestId) || this.mediaStream !== stream) {
        return;
      }
      this.handleCameraPlaybackError(error);
      this.stopCameraStream();
      return;
    }

    if (!this.isCurrentCameraRequest(requestId) || this.mediaStream !== stream) {
      return;
    }

    this.startScanningLoop();

    // Additional safeguard: start scanning when video frames arrive if not already scanning
    video.onloadeddata = () => {
      if (
        this.isCurrentCameraRequest(requestId) &&
        this.mediaStream === stream &&
        !this.scanHandled
      ) {
        this.startScanningLoop();
      }
    };
  }

  private startScanningLoop(): void {
    if (this.isDestroyed || this.scanHandled || this.animFrameId !== null) {
      return;
    }

    const video = this.videoRef?.()?.nativeElement;
    const canvas = this.canvasRef?.()?.nativeElement;
    if (!video || !canvas) {
      return;
    }

    const scanGeneration = this.scanGeneration;
    this.lastScanTimestamp = 0;

    const tick = (timestamp: number): void => {
      if (this.isDestroyed || this.scanHandled || scanGeneration !== this.scanGeneration) {
        return;
      }

      // Throttle analysis to once every SCAN_INTERVAL_MS (eliminates UI lag and stutter)
      const elapsed = timestamp - this.lastScanTimestamp;
      if (elapsed >= SCAN_INTERVAL_MS) {
        this.lastScanTimestamp = timestamp;

        if (
          video.readyState >= (video.HAVE_CURRENT_DATA || 2) &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          const vWidth = video.videoWidth;
          const vHeight = video.videoHeight;

          // Region of Interest (ROI): crop exactly what the centered visual reticle covers.
          const { cropSize, cropX, cropY } = this.getReticleCrop(video, vWidth, vHeight);

          const targetSize = Math.min(cropSize, ANALYSIS_SIZE);
          if (canvas.width !== targetSize || canvas.height !== targetSize) {
            canvas.width = targetSize;
            canvas.height = targetSize;
          }

          try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, targetSize, targetSize);
              const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
              const code = jsQR(imageData.data, targetSize, targetSize, {
                inversionAttempts: 'attemptBoth',
              });

              if (code?.data?.trim()) {
                this.onQrDetected(code.data.trim());
                return;
              }
            }
          } catch {
            // A frame can become invalid while the camera is switching modes.
            // Keep the loop alive and analyze the next frame instead.
          }
        }
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private onQrDetected(detectedText: string): void {
    if (this.scanHandled) {
      return;
    }
    this.scanHandled = true;

    // Visual lock-on & immediate haptic tap
    this.scanSuccess.set(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(100);
      } catch {
        // ignore
      }
    }

    const processor = this.processScan();
    if (processor) {
      this.lastScannedPayload = detectedText;
      // Stop camera feed immediately to free device hardware
      this.stopCameraStream();
      this.viewState.set('submitting');
      void this.executeScanProcessing(detectedText, processor);
      return;
    }

    // Fallback mode without processor: brief visual lock-on then emit scanned
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.successTimeoutId = setTimeout(() => {
      this.cleanup();
      this.scanned.emit(detectedText);
    }, 240);
  }

  private async executeScanProcessing(
    payload: string,
    processor: (text: string) => Promise<ScanSubmitResult>,
  ): Promise<void> {
    try {
      const result = await processor(payload);
      if (this.isDestroyed) {
        return;
      }

      if (result.status === 'success') {
        this.successInfo.set({
          sessionTitle: result.sessionTitle,
          attendanceStatus: result.attendanceStatus ?? 'PRESENT',
          message: result.message ?? `Attendance marked as Present for ${result.sessionTitle}.`,
        });
        this.viewState.set('success');
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch {
            // ignore
          }
        }
        this.completed.emit(result);
      } else if (result.status === 'location-blocked') {
        this.locationErrorInfo.set({
          sessionTitle: result.sessionTitle,
          reason: result.reason,
          message: result.message,
        });
        this.viewState.set('location-blocked');
      } else if (result.status === 'due-blocked') {
        this.generalErrorInfo.set({
          title: 'Cannot mark present',
          message: result.message,
        });
        this.viewState.set('error');
      } else {
        this.generalErrorInfo.set({
          title: 'Scan error',
          message: result.message,
        });
        this.viewState.set('error');
      }
    } catch {
      if (this.isDestroyed) {
        return;
      }
      this.generalErrorInfo.set({
        title: 'Could not mark attendance',
        message: 'An unexpected error occurred while processing attendance. Please try again.',
      });
      this.viewState.set('error');
    }
  }

  private handleCameraError(err: unknown): void {
    const errorName = (err as { name?: string })?.name ?? '';
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      this.cameraStatus.set('denied');
      this.errorMessage.set(
        'Camera permission was denied. Allow camera access in your browser or device settings, then try again.',
      );
    } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      this.cameraStatus.set('unavailable');
      this.errorMessage.set('No camera was detected on this device.');
    } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      this.cameraStatus.set('error');
      this.errorMessage.set('The camera is currently in use by another application or tab.');
    } else {
      this.cameraStatus.set('error');
      this.errorMessage.set(
        'Could not access the camera. Check your browser permissions and try again.',
      );
    }
  }

  private handleCameraPlaybackError(err: unknown): void {
    const errorName = (err as { name?: string })?.name ?? '';
    this.cameraStatus.set('error');
    this.errorMessage.set(
      errorName === 'NotAllowedError'
        ? 'The camera preview could not start. Tap Try again to restart it.'
        : 'The camera preview could not start. Check your browser permissions and try again.',
    );
  }

  private isCurrentCameraRequest(requestId: number): boolean {
    return !this.isDestroyed && requestId === this.cameraRequestId;
  }

  private getReticleCrop(
    video: HTMLVideoElement,
    videoWidth: number,
    videoHeight: number,
  ): { cropSize: number; cropX: number; cropY: number } {
    const videoRect = video.getBoundingClientRect();
    const reticleRect = this.reticleRef?.()?.nativeElement.getBoundingClientRect();

    if (
      videoRect.width > 0 &&
      videoRect.height > 0 &&
      reticleRect &&
      reticleRect.width > 0 &&
      reticleRect.height > 0
    ) {
      // object-fit: cover scales the source until the viewport is filled. Convert
      // the reticle's CSS bounds back into source pixels before cropping. The
      // object-position is centered, so account for the source overflow as well
      // as the reticle's actual position instead of assuming it is centered.
      const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
      const requestedSize = Math.floor(Math.min(reticleRect.width, reticleRect.height) / scale);
      const cropSize = Math.max(1, Math.min(requestedSize, videoWidth, videoHeight));
      const renderedWidth = videoWidth * scale;
      const renderedHeight = videoHeight * scale;
      const contentOffsetX = (videoRect.width - renderedWidth) / 2;
      const contentOffsetY = (videoRect.height - renderedHeight) / 2;
      const reticleCenterX =
        (reticleRect.left - videoRect.left + reticleRect.width / 2 - contentOffsetX) / scale;
      const reticleCenterY =
        (reticleRect.top - videoRect.top + reticleRect.height / 2 - contentOffsetY) / scale;
      return {
        cropSize,
        cropX: Math.max(
          0,
          Math.min(videoWidth - cropSize, Math.floor(reticleCenterX - cropSize / 2)),
        ),
        cropY: Math.max(
          0,
          Math.min(videoHeight - cropSize, Math.floor(reticleCenterY - cropSize / 2)),
        ),
      };
    }

    const cropSize = Math.max(1, Math.floor(Math.min(videoWidth, videoHeight) * CROP_BOX_RATIO));
    return {
      cropSize,
      cropX: Math.floor((videoWidth - cropSize) / 2),
      cropY: Math.floor((videoHeight - cropSize) / 2),
    };
  }

  private stopCameraStream(): void {
    this.scanGeneration += 1;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.successTimeoutId !== null) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }
    const video = this.videoRef?.()?.nativeElement;
    if (video) {
      video.onloadeddata = null;
      try {
        video.pause();
      } catch {
        // ignore
      }
      video.srcObject = null;
    }
  }

  private cleanup(): void {
    this.isDestroyed = true;
    this.cameraRequestId += 1;
    this.stopCameraStream();
  }
}
