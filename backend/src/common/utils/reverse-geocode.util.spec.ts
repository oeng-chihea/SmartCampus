import {
  buildScanLocationLabel,
  namedPlacesFromOverpass,
  pickClosestNamedPlace,
  usableNearbyPlaceName,
} from './reverse-geocode.util';

describe('buildScanLocationLabel', () => {
  it('builds a compact place + road + city label', () => {
    expect(
      buildScanLocationLabel({
        name: 'Institute of Technology of Cambodia',
        addresstype: 'university',
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

  it('uses the area lookup for sangkat so a long road does not steal the district', () => {
    expect(
      buildScanLocationLabel(
        {
          addresstype: 'road',
          address: {
            road: 'Yothapol Khemarak Phoumin Boulevard (Street 271)',
            suburb: 'បឹងទំពុន',
            village: 'Sangkat Chak Angrae Leu',
            state: 'Phnom Penh',
          },
        },
        {
          addresstype: 'hamlet',
          address: {
            hamlet: 'Boeung Trabek',
            village: 'Sangkat Phsar Daeum Thkov',
            town: 'Khan Chamkar Mon',
            state: 'Phnom Penh',
          },
        },
      ),
    ).toBe(
      'Yothapol Khemarak Phoumin Boulevard (Street 271), Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    );
  });

  it('ignores tourism / hostel POI names', () => {
    expect(
      buildScanLocationLabel({
        name: 'My Sweet Home',
        addresstype: 'tourism',
        address: {
          tourism: 'My Sweet Home',
          road: 'Street 430',
          village: 'Sangkat Phsar Daeum Thkov',
          state: 'Phnom Penh',
        },
      }),
    ).toBe('Street 430, Sangkat Phsar Daeum Thkov, Phnom Penh');
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

  it('prefixes a nearby named apartment from the live search', () => {
    expect(
      buildScanLocationLabel(
        {
          addresstype: 'road',
          address: {
            road: 'Street 430',
            village: 'Sangkat Phsar Daeum Thkov',
            state: 'Phnom Penh',
          },
        },
        {
          addresstype: 'hamlet',
          address: {
            hamlet: 'Boeung Trabek',
            village: 'Sangkat Phsar Daeum Thkov',
            state: 'Phnom Penh',
          },
        },
        'Elite Town III',
      ),
    ).toBe(
      'Elite Town III, Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    );
  });

  it('dedupes the Nominatim name when it matches building', () => {
    expect(
      buildScanLocationLabel({
        name: 'Building A',
        addresstype: 'building',
        address: {
          building: 'Building A',
          road: 'Campus Road',
          city: 'Phnom Penh',
        },
      }),
    ).toBe('Building A, Campus Road, Phnom Penh');
  });
});

describe('usableNearbyPlaceName', () => {
  it('accepts a nearby named apartment and skips a hostel snap', () => {
    expect(
      usableNearbyPlaceName(
        {
          name: 'Elite Town III',
          addresstype: 'residential',
          lat: 11.5282,
          lon: 104.9231,
          address: { residential: 'Elite Town III' },
        },
        11.52825,
        104.92312,
      ),
    ).toBe('Elite Town III');

    expect(
      usableNearbyPlaceName(
        {
          name: 'My Sweet Home',
          addresstype: 'tourism',
          type: 'hostel',
          lat: 11.5282733,
          lon: 104.9224042,
          address: { tourism: 'My Sweet Home' },
        },
        11.528287,
        104.923046,
      ),
    ).toBeNull();
  });
});

describe('pickClosestNamedPlace', () => {
  it('picks the closest apartment and skips a nearer hostel', () => {
    const chosen = pickClosestNamedPlace(
      [
        {
          name: 'My Sweet Home',
          latitude: 11.528273,
          longitude: 104.922404,
          type: 'hostel',
        },
        {
          name: 'Rainbow Residences',
          latitude: 11.52832,
          longitude: 104.92305,
          type: 'apartments',
        },
      ],
      11.52835,
      104.923,
      80,
    );
    expect(chosen?.name).toBe('Rainbow Residences');
  });

  it('returns null when every named place is too far', () => {
    expect(
      pickClosestNamedPlace(
        [
          {
            name: 'Far Building',
            latitude: 11.54,
            longitude: 104.94,
            type: 'building',
          },
        ],
        11.52835,
        104.923,
        80,
      ),
    ).toBeNull();
  });
});

describe('namedPlacesFromOverpass', () => {
  it('reads English names and drops shops / house numbers', () => {
    const places = namedPlacesFromOverpass({
      elements: [
        {
          type: 'way',
          center: { lat: 11.5283, lon: 104.923 },
          tags: { name: 'Rainbow Residences', building: 'apartments' },
        },
        {
          type: 'node',
          lat: 11.5282,
          lon: 104.9228,
          tags: { name: 'FairyTale Fashion', shop: 'clothes' },
        },
        {
          type: 'way',
          center: { lat: 11.5284, lon: 104.9231 },
          tags: { name: '23', building: 'yes' },
        },
      ],
    });
    expect(places.map((place) => place.name)).toEqual(['Rainbow Residences']);
  });
});
