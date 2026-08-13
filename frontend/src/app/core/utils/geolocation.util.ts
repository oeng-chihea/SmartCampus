/** Raw device coordinates read from the browser Geolocation API. */
export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
}

export type GeolocationFailureReason =
  | 'insecure'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export type GeolocationReadResult =
  | { ok: true; coords: DeviceCoordinates }
  | { ok: false; reason: GeolocationFailureReason };

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Reads the student's current position for the attendance geofence check
 * (FR-02). Never throws — callers treat `ok: false` as a hard submit block.
 */
export function getCurrentCoordinates(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GeolocationReadResult> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: 'insecure' });
  }

  if (!('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        }),
      (error) => resolve({ ok: false, reason: reasonFromPositionError(error) }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

function reasonFromPositionError(
  error: GeolocationPositionError | undefined,
): GeolocationFailureReason {
  switch (error?.code) {
    case 1:
      return 'denied';
    case 3:
      return 'timeout';
    case 2:
      return 'unavailable';
    default:
      return 'unavailable';
  }
}
