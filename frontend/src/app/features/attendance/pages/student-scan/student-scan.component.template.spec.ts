import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'student-scan.component.html'), 'utf8');
const styles = readFileSync(join(__dirname, 'student-scan.component.scss'), 'utf8');
const componentSource = readFileSync(join(__dirname, 'student-scan.component.ts'), 'utf8');

describe('Student scan mobile experience', () => {
  it('does not start Campus Voice or all maps during initial page rendering', () => {
    expect(template).toContain('[autoStart]="false"');
    expect(template).toContain('@defer (on viewport)');
    expect(template).toContain('student-scan__map-placeholder');
  });

  it('includes mobile-safe spacing and reduced-motion safeguards', () => {
    expect(styles).toContain('env(safe-area-inset-bottom)');
    expect(styles).toContain('@media (hover: none)');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('does not expose exact GPS coordinates in the student attendance view', () => {
    expect(template).not.toContain('<dt>Coordinates</dt>');
    expect(template).not.toContain('coordinatesLabel(record)');
    expect(componentSource).not.toContain('formatScanCoordinates');
    expect(componentSource).not.toContain('formatScannedAtCell');
  });

  it('keeps the attendance history readable while horizontally scrolling', () => {
    expect(template).toContain('[stickyFirstColumn]="false"');
    expect(componentSource).toContain('truncate: true');
  });

  it('keeps the session QR while removing Camera URL instructions', () => {
    expect(template).toContain('Mark me present');
    expect(template).toContain('qrDataUrl');
    expect(template).toContain('QR code for');
    expect(template).toContain('Attendance code');
    expect(template).not.toContain('Scan this URL with Camera');
    expect(template).not.toContain('student/scan?payload');
  });

  it('provides an in-app camera QR scanner button and dialog', () => {
    expect(template).toContain('Scan QR code');
    expect(template).toContain('(click)="openScanner()"');
    expect(template).toContain('<app-qr-scanner-dialog');
    expect(template).toContain('(scanned)="onQrScanned($event)"');
    expect(componentSource).toContain('openScanner()');
    expect(componentSource).toContain('closeScanner()');
    expect(componentSource).toContain('onQrScanned(');
    expect(componentSource).toContain('QrScannerDialogComponent');
    expect(styles).toContain('.student-scan__btn--scan');
  });

  it('provides a clean mobile session card with View Details button to open full session info dialog', () => {
    expect(template).toContain('student-scan__session-desktop-details');
    expect(template).toContain('openSessionDetail(session)');
    expect(template).toContain('View details');
    expect(template).toContain('selectedSessionDetail()');
    expect(template).toContain('closeSessionDetail()');
    expect(template).toContain('session-detail-dialog');
    expect(componentSource).toContain('readonly selectedSessionDetail = signal');
    expect(componentSource).toContain('openSessionDetail(');
    expect(componentSource).toContain('closeSessionDetail(');
    expect(styles).toContain('.student-scan__session-desktop-details');
    expect(styles).toContain('.student-scan__btn--details');
    expect(styles).toContain('.session-detail-dialog');
  });

  it('hides desktop details on mobile media query to keep the mobile cards clean', () => {
    expect(styles).toContain('.student-scan__session-desktop-details');
    expect(styles).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.student-scan__session-desktop-details\s*\{\s*display:\s*none\s*!important;/,
    );
  });

  it('keeps recorded scans history clean on mobile and provides a review dialog', () => {
    expect(componentSource).toMatch(/key:\s*'scannedAt'[\s\S]*?hideOnMobile:\s*true/);
    expect(componentSource).toMatch(/key:\s*'status'[\s\S]*?hideOnMobile:\s*true/);
    expect(template).toContain('selectedRecord()');
    expect(template).toContain('[spacious]="false"');
    expect(template).toContain('closeRecordDetail()');
  });

  it('displays session cards in a compact list-rows-layout on mobile instead of a vertical portrait layout', () => {
    expect(styles).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.student-scan__session-list\s*\{[\s\S]*?flex-direction:\s*column;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.student-scan__card-action\s*\{[\s\S]*?flex-direction:\s*row;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 639px\)[\s\S]*?\.student-scan__session-meta\s*\{[\s\S]*?flex-direction:\s*row;/,
    );
  });
});

