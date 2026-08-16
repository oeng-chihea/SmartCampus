import { describe, expect, it } from 'vitest';
import {
  distanceBadgeVariant,
  formatDistanceMeters,
  formatGpsReading,
  formatScanAccuracyChip,
  formatScannedAtCell,
} from './format.util';

describe('formatGpsReading', () => {
  it('prints the four diagnostic fields', () => {
    expect(
      formatGpsReading({
        latitude: 11.52832,
        longitude: 104.922968,
        accuracyMeters: 12,
        timestampMs: Date.parse('2026-08-16T02:31:05.000Z'),
      }),
    ).toBe(
      [
        'latitude: 11.528320',
        'longitude: 104.922968',
        'accuracy: 12m',
        'timestamp: 2026-08-16T02:31:05.000Z',
      ].join('\n'),
    );
  });
});

describe('formatScanAccuracyChip', () => {
  it('labels GPS accuracy for the table chip', () => {
    expect(formatScanAccuracyChip(16)).toEqual({
      label: '±16 m',
      title: 'Phone GPS accuracy ±16 m',
    });
  });

  it('returns nothing when accuracy is missing', () => {
    expect(formatScanAccuracyChip(null)).toBeUndefined();
  });
});

describe('formatDistanceMeters', () => {
  it('prints a rounded meter badge label', () => {
    expect(formatDistanceMeters(3046)).toBe('3046 m');
    expect(formatDistanceMeters(12.6)).toBe('13 m');
  });

  it('falls back to an em dash when distance is missing', () => {
    expect(formatDistanceMeters(null)).toBe('—');
    expect(formatDistanceMeters(undefined)).toBe('—');
    expect(formatDistanceMeters(Number.NaN)).toBe('—');
  });
});

describe('distanceBadgeVariant', () => {
  it('uses the distance token when a number is present', () => {
    expect(distanceBadgeVariant(2908)).toBe('distance');
  });

  it('uses the empty token when distance is missing', () => {
    expect(distanceBadgeVariant(null)).toBe('empty');
  });
});

describe('formatScannedAtCell', () => {
  it('keeps coordinates in the subtitle and accuracy in a chip', () => {
    expect(
      formatScannedAtCell(
        'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
        11.52824,
        104.923032,
        60,
      ),
    ).toEqual({
      title: 'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
      subtitle: '11.528240, 104.923032',
      chip: {
        label: '±60 m',
        title: 'Phone GPS accuracy ±60 m',
      },
      truncate: true,
      titleAttr: 'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    });
  });

  it('falls back to coordinates as the title when the place name is missing', () => {
    expect(formatScannedAtCell(null, 11.528035, 104.922967, 16)).toEqual({
      title: '11.528035, 104.922967',
      chip: {
        label: '±16 m',
        title: 'Phone GPS accuracy ±16 m',
      },
    });
  });
});
