import { describe, expect, it } from 'vitest';
import {
  distanceBadgeVariant,
  formatDistanceMeters,
  formatGeofenceStatus,
  formatGpsReading,
  formatScanAccuracyChip,
  formatScannedAtCell,
  formatScannedAtPlace,
  buildGoogleMapsUrl,
} from './format.util';

describe('buildGoogleMapsUrl', () => {
  it('builds a Google Maps link from the exact scan coordinates', () => {
    expect(buildGoogleMapsUrl(11.529053, 104.923448)).toBe(
      'https://www.google.com/maps/search/?api=1&query=11.529053%2C104.923448',
    );
  });

  it('returns no link when the scan coordinates are unavailable or invalid', () => {
    expect(buildGoogleMapsUrl(null, 104.923448)).toBeNull();
    expect(buildGoogleMapsUrl(11.529053, Number.NaN)).toBeNull();
  });
});

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

describe('formatGeofenceStatus', () => {
  it('labels an inside-zone scan as Inside', () => {
    expect(formatGeofenceStatus('Inside')).toBe('Inside');
  });

  it('keeps Outside Location and shows no location for an absent row', () => {
    expect(formatGeofenceStatus('Outside Location')).toBe('Outside Location');
    expect(formatGeofenceStatus(null)).toBe('—');
  });
});

describe('formatScannedAtPlace', () => {
  it('prefers the reverse-geocoded place name', () => {
    expect(
      formatScannedAtPlace('Elite Town III, Koh Pich', 'Building A, Room 201'),
    ).toBe('Elite Town III, Koh Pich');
  });

  it('falls back to the campus zone name when geocode is missing', () => {
    expect(formatScannedAtPlace(null, 'Building A, Room 201')).toBe(
      'Building A, Room 201',
    );
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

  it('falls back to the campus zone name when the place name is missing', () => {
    expect(
      formatScannedAtCell(null, 11.528035, 104.922967, 16, 'Building A, Room 201'),
    ).toEqual({
      title: 'Building A, Room 201',
      subtitle: '11.528035, 104.922967',
      chip: {
        label: '±16 m',
        title: 'Phone GPS accuracy ±16 m',
      },
      truncate: true,
      titleAttr: 'Building A, Room 201',
    });
  });

  it('omits the accuracy chip when meters are not passed', () => {
    expect(
      formatScannedAtCell(
        'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
        11.52824,
        104.923032,
      ),
    ).toEqual({
      title: 'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
      subtitle: '11.528240, 104.923032',
      chip: undefined,
      truncate: true,
      titleAttr: 'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    });
  });
});
