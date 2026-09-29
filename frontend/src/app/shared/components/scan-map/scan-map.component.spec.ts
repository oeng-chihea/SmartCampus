// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScanMapComponent } from './scan-map.component';

const styles = readFileSync(join(__dirname, 'scan-map.component.scss'), 'utf8');

type ScanMapComponentInternals = {
  scanMapFitKey(
    zone: { latitude: number; longitude: number; radiusMeters: number } | null,
    device: { latitude: number; longitude: number; accuracyMeters?: number } | null,
  ): string;
};

function scanMapFitKey(
  zone: { latitude: number; longitude: number; radiusMeters: number } | null,
  device: { latitude: number; longitude: number; accuracyMeters?: number } | null,
): string {
  const component = Object.create(ScanMapComponent.prototype) as ScanMapComponentInternals;
  return component.scanMapFitKey(zone, device);
}

describe('ScanMapComponent render state', () => {
  it('keeps the viewport fit key stable when only the device GPS point moves', () => {
    const zone = { latitude: 11.5479313, longitude: 104.9405941, radiusMeters: 200 };
    const firstFix = { latitude: 11.5479, longitude: 104.9405, accuracyMeters: 12 };
    const movedFix = { latitude: 11.5481, longitude: 104.9407, accuracyMeters: 9 };

    expect(scanMapFitKey(zone, firstFix)).toBe('zone:11.5479313:104.9405941:200:device');
    expect(scanMapFitKey(zone, movedFix)).toBe('zone:11.5479313:104.9405941:200:device');
    expect(scanMapFitKey(zone, null)).toBe('zone:11.5479313:104.9405941:200:no-device');
  });
});

describe('ScanMapComponent styling', () => {
  it('supports a borderless variant for maps embedded in detail dialogs', () => {
    expect(styles).toContain(':host(.scan-map--borderless) .scan-map');
    expect(styles).toContain('border: 0;');
  });
});
