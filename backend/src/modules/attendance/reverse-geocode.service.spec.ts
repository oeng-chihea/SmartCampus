import { ReverseGeocodeService } from './reverse-geocode.service';

describe('ReverseGeocodeService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('composes a street + area label from one Nominatim call', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        addresstype: 'road',
        address: {
          road: 'Street 430',
          hamlet: 'Boeung Trabek',
          village: 'Sangkat Phsar Daeum Thkov',
          state: 'Phnom Penh',
        },
      }),
    })) as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await expect(service.lookup(11.528405, 104.922953, 40)).resolves.toBe(
      'Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'layer=address',
    );
  });

  it('uses a nearby building name from the same reverse payload', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        name: 'Rainbow Residences',
        addresstype: 'residential',
        lat: '11.52832',
        lon: '104.92302',
        address: {
          residential: 'Rainbow Residences',
          road: 'Street 430',
          hamlet: 'Boeung Trabek',
          village: 'Sangkat Phsar Daeum Thkov',
          state: 'Phnom Penh',
        },
      }),
    })) as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await expect(service.lookup(11.528405, 104.922953, 40)).resolves.toBe(
      'Rainbow Residences, Street 430, Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    );
  });

  it('omits the street when accuracy is too coarse', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        addresstype: 'hamlet',
        address: {
          hamlet: 'Boeung Trabek',
          village: 'Sangkat Phsar Daeum Thkov',
          state: 'Phnom Penh',
        },
      }),
    })) as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await expect(service.lookup(11.528405, 104.922953, 220)).resolves.toBe(
      'Boeung Trabek, Sangkat Phsar Daeum Thkov, Phnom Penh',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null when Nominatim is down and does not throw', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await expect(service.lookup(11.5479313, 104.9405941)).resolves.toBeNull();
  });

  it('reuses a cached lookup for nearly identical coordinates', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        address: { road: 'Campus Road', city: 'Phnom Penh' },
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await service.lookup(11.5479313, 104.9405941);
    await service.lookup(11.5479318, 104.9405944);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
