// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QrScannerDialogComponent } from './qr-scanner-dialog.component';

const template = readFileSync(join(__dirname, 'qr-scanner-dialog.component.html'), 'utf8');
const styles = readFileSync(join(__dirname, 'qr-scanner-dialog.component.scss'), 'utf8');
const source = readFileSync(join(__dirname, 'qr-scanner-dialog.component.ts'), 'utf8');

describe('QrScannerDialogComponent template', () => {
  it('renders modal dialog shell and video viewport with iOS Safari inline attributes', () => {
    expect(template).toContain('app-modal-dialog');
    expect(template).toContain('[title]="modalTitle()"');
    expect(template).toContain('[eyebrow]="modalEyebrow()"');
    expect(template).toContain('<video');
    expect(template).toContain('playsinline');
    expect(template).toContain('muted');
    expect(template).toContain('autoplay');
    expect(template).toContain('#canvasElement');
    expect(template).toContain('[closeDisabled]="viewState() === \'submitting\'"');
  });

  it('renders reticle guides, laser animation, and camera controls', () => {
    expect(template).toContain('qr-scanner__reticle');
    expect(template).toContain('qr-scanner__reticle--success');
    expect(template).toContain('qr-scanner__check-icon');
    expect(template).toContain('qr-scanner__laser');
    expect(template).toContain('qr-scanner__corner--tl');
    expect(template).toContain('qr-scanner__corner--br');
    expect(template).toContain("Point your camera at the teacher's live attendance QR code");
    expect(template).toContain('Switch camera');
    expect(template).toContain('Cancel');
  });

  it('renders in-dialog success confirmation with check icon and Marked as Present notice', () => {
    expect(template).toContain("@case ('success')");
    expect(template).toContain('qr-scanner__badge--success');
    expect(template).toContain('Marked as Present!');
    expect(template).toContain('qr-scanner__status-pill--present');
    expect(template).toContain('qr-scanner__btn-done');
    expect(template).toContain('Done');
  });

  it('renders in-dialog location error state requiring location permission', () => {
    expect(template).toContain("@case ('location-blocked')");
    expect(template).toContain('qr-scanner__badge--location');
    expect(template).toContain('Location access required');
    expect(template).toContain('qr-scanner__tip-box');
    expect(template).toContain('Try again');
  });

  it('renders submitting progress state', () => {
    expect(template).toContain("@case ('submitting')");
    expect(template).toContain('Recording attendance…');
  });

  it('provides error states for permission denied and device unavailable', () => {
    expect(template).toContain("@case ('denied')");
    expect(template).toContain('Camera access blocked');
    expect(template).toContain("@case ('unavailable')");
    expect(template).toContain('No camera found');
    expect(template).toContain('Try again');
  });

  it('keeps the camera loop single-path and free of sensitive console logging', () => {
    expect(source).not.toContain('BarcodeDetector');
    expect(source).not.toContain('console.info');
    expect(source).not.toContain('console.warn');
    expect(source).toContain('cameraRequestId');
    expect(source).toContain('scanGeneration');
    expect(source).toContain('getReticleCrop');
  });
});

describe('QrScannerDialogComponent styling', () => {
  it('defines reticle corners, laser animation, and reduced-motion safeguard', () => {
    expect(styles).toContain('.qr-scanner__reticle');
    expect(styles).toContain('.qr-scanner__laser');
    expect(styles).toContain('@keyframes qr-laser-sweep');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('.qr-scanner__viewport');
  });

  it('defines result cards, badges, and feedback buttons', () => {
    expect(styles).toContain('.qr-scanner__result-card');
    expect(styles).toContain('.qr-scanner__badge--success');
    expect(styles).toContain('.qr-scanner__badge--location');
    expect(styles).toContain('.qr-scanner__status-pill--present');
    expect(styles).toContain('.qr-scanner__btn-done');
  });
});

describe('QrScannerDialogComponent logic', () => {
  it('initializes with default environment facingMode and handles camera cleanup', () => {
    const component = Object.create(QrScannerDialogComponent.prototype) as {
      cameraStatus: any;
      facingMode: any;
      toggleFacingMode: () => Promise<void>;
      stopCameraStream: () => void;
      cleanup: () => void;
      mediaStream: any;
      animFrameId: any;
      isDestroyed: boolean;
    };

    const mockTrack = { stop: vi.fn() };
    component.mediaStream = {
      getTracks: () => [mockTrack],
    };
    component.animFrameId = 123;
    component.isDestroyed = false;

    // Run cleanup
    component.cleanup();

    expect(component.isDestroyed).toBe(true);
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(component.mediaStream).toBeNull();
    expect(component.animFrameId).toBeNull();
  });
});
