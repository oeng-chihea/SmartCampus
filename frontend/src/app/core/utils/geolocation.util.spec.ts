import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentCoordinates,
  toDeviceCoordinates,
  watchDeviceLocation,
} from './geolocation.util';

const FIXED_TIMESTAMP = 1_723_795_860_000;

function stubGeolocation(impl: {
  getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback) => void;
  watchPosition?: (success: PositionCallback, error?: PositionErrorCallback) => number;
  clearWatch?: (id: number) => void;
}): void {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: impl,
  });
}

function position(latitude: number, longitude: number, accuracy?: number): GeolocationPosition {
  return {
    coords: { latitude, longitude, accuracy },
    timestamp: FIXED_TIMESTAMP,
  } as GeolocationPosition;
}

describe('geolocation.util', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
    vi.useRealTimers();
  });

  describe('toDeviceCoordinates', () => {
    it('converts a stored scan position into map coordinates', () => {
      expect(toDeviceCoordinates(11.528348, 104.923057, 16)).toEqual({
        latitude: 11.528348,
        longitude: 104.923057,
        accuracyMeters: 16,
      });
    });

    it('rejects incomplete or invalid positions so the UI cannot draw a false pin', () => {
      expect(toDeviceCoordinates(null, 104.923057, 16)).toBeNull();
      expect(toDeviceCoordinates(11.528348, Number.NaN, 16)).toBeNull();
      expect(toDeviceCoordinates(91, 104.923057, 16)).toBeNull();
      expect(toDeviceCoordinates(11.528348, 181, 16)).toBeNull();
    });

    it('omits invalid accuracy while keeping a valid position usable', () => {
      expect(toDeviceCoordinates(11.528348, 104.923057, -1)).toEqual({
        latitude: 11.528348,
        longitude: 104.923057,
        accuracyMeters: null,
      });
    });
  });

  it('resolves coordinates on success when watchPosition is unavailable', async () => {
    stubGeolocation({
      getCurrentPosition: (success) => {
        success(position(11.5479313, 104.9405941, 18));
      },
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: true,
      coords: {
        latitude: 11.5479313,
        longitude: 104.9405941,
        accuracyMeters: 18,
        timestampMs: FIXED_TIMESTAMP,
      },
    });
  });

  it('accepts the first reading immediately, including a coarse fix', async () => {
    stubGeolocation({
      getCurrentPosition: (success) => {
        success(position(11.52832, 104.922968, 68));
      },
      watchPosition: (success) => {
        success(position(11.52832, 104.922968, 68));
        return 7;
      },
      clearWatch: () => undefined,
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: true,
      coords: {
        latitude: 11.52832,
        longitude: 104.922968,
        accuracyMeters: 68,
        timestampMs: FIXED_TIMESTAMP,
      },
    });
  });

  it('reports denied when the browser rejects the request', async () => {
    stubGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    });

    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: false,
      reason: 'denied',
    });
  });

  it('reports timeout when no reading arrives at all', async () => {
    vi.useFakeTimers();
    stubGeolocation({
      getCurrentPosition: () => undefined,
      watchPosition: () => 1,
      clearWatch: () => undefined,
    });

    const pending = getCurrentCoordinates(5_000);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({
      ok: false,
      reason: 'timeout',
    });
  });

  it('preserves position-unavailable errors when the provider cannot return a fix', async () => {
    vi.useFakeTimers();
    const clearWatch = vi.fn();
    stubGeolocation({
      getCurrentPosition: (_success, error) => {
        error?.({ code: 2, message: 'position unavailable' } as GeolocationPositionError);
      },
      watchPosition: (_success, error) => {
        error?.({ code: 2, message: 'position unavailable' } as GeolocationPositionError);
        return 11;
      },
      clearWatch,
    });

    const pending = getCurrentCoordinates(5_000);
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(pending).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(clearWatch).toHaveBeenCalledWith(11);
  });

  it('reports unsupported when geolocation is missing', async () => {
    Reflect.deleteProperty(globalThis.navigator, 'geolocation');
    await expect(getCurrentCoordinates()).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('watchDeviceLocation emits live fixes and can be stopped', () => {
    const clearWatch = vi.fn();
    stubGeolocation({
      getCurrentPosition: () => undefined,
      watchPosition: (success) => {
        success(position(11.528, 104.923, 40));
        return 3;
      },
      clearWatch,
    });

    const seen: unknown[] = [];
    const stop = watchDeviceLocation((result) => seen.push(result));
    expect(seen).toEqual([
      {
        ok: true,
        coords: {
          latitude: 11.528,
          longitude: 104.923,
          accuracyMeters: 40,
          timestampMs: FIXED_TIMESTAMP,
        },
      },
    ]);
    stop();
    expect(clearWatch).toHaveBeenCalledWith(3);
  });
});
