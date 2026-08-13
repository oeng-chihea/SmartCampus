import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentCoordinates } from './geolocation.util';

function stubGeolocation(
  impl: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void,
): void {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: impl },
  });
}

describe('geolocation.util', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
  });

  it('resolves coordinates on success', async () => {
    stubGeolocation((success) => {
      success({
        coords: { latitude: 11.5479313, longitude: 104.9405941 },
      } as GeolocationPosition);
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: true,
      coords: { latitude: 11.5479313, longitude: 104.9405941 },
    });
  });

  it('reports denied when the browser rejects the request', async () => {
    stubGeolocation((_success, error) => {
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: false,
      reason: 'denied',
    });
  });

  it('reports timeout when the GPS fix times out', async () => {
    stubGeolocation((_success, error) => {
      error?.({ code: 3, message: 'timeout' } as GeolocationPositionError);
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });

  it('reports unsupported when geolocation is missing', async () => {
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });
});
