import { ReverseGeocodeService } from './reverse-geocode.service';

describe('ReverseGeocodeService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns a compact place name from Nominatim', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        name: 'Institute of Technology of Cambodia',
        display_name: 'Institute of Technology of Cambodia, Phnom Penh, Cambodia',
        address: {
          amenity: 'Institute of Technology of Cambodia',
          road: 'Russian Federation Boulevard',
          city: 'Phnom Penh',
        },
      }),
    })) as unknown as typeof fetch;

    const service = new ReverseGeocodeService();
    await expect(service.lookup(11.5479313, 104.9405941)).resolves.toBe(
      'Institute of Technology of Cambodia, Russian Federation Boulevard, Phnom Penh',
    );
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
