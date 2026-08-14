import { buildScanLocationLabel } from './reverse-geocode.util';

describe('buildScanLocationLabel', () => {
  it('builds a compact place + road + city label', () => {
    expect(
      buildScanLocationLabel({
        name: 'Institute of Technology of Cambodia',
        display_name:
          'Institute of Technology of Cambodia, Russian Federation Boulevard, Phum 9, Sangkat Teuk Thla, Khan Sen Sok, Phnom Penh, 12102, Cambodia',
        address: {
          amenity: 'Institute of Technology of Cambodia',
          road: 'Russian Federation Boulevard',
          suburb: 'Sangkat Teuk Thla',
          city: 'Phnom Penh',
        },
      }),
    ).toBe(
      'Institute of Technology of Cambodia, Russian Federation Boulevard, Sangkat Teuk Thla, Phnom Penh',
    );
  });

  it('falls back to a shortened display_name when address parts are missing', () => {
    expect(
      buildScanLocationLabel({
        display_name: 'Street 598, Phum 9, Phnom Penh, Cambodia',
      }),
    ).toBe('Street 598, Phum 9, Phnom Penh, Cambodia');
  });

  it('returns null when the payload is empty', () => {
    expect(buildScanLocationLabel(null)).toBeNull();
    expect(buildScanLocationLabel({})).toBeNull();
  });

  it('reads Cambodia OSM residential + sangkat + city-state', () => {
    expect(
      buildScanLocationLabel({
        display_name:
          'Elite Town III, Koh Pich, Sangkat Tonle Bassac, Khan Chamkar Mon, Phnom Penh, 120101, Cambodia',
        address: {
          residential: 'Elite Town III',
          suburb: 'Koh Pich',
          village: 'Sangkat Tonle Bassac',
          town: 'Khan Chamkar Mon',
          state: 'Phnom Penh',
          country: 'Cambodia',
        },
      }),
    ).toBe('Elite Town III, Koh Pich, Sangkat Tonle Bassac, Phnom Penh');
  });

  it('dedupes the Nominatim name when it matches amenity', () => {
    expect(
      buildScanLocationLabel({
        name: 'Building A',
        address: {
          building: 'Building A',
          road: 'Campus Road',
          city: 'Phnom Penh',
        },
      }),
    ).toBe('Building A, Campus Road, Phnom Penh');
  });
});
