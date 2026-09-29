/** Raw device coordinates read from the browser Geolocation API. */
export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in meters. Null when the browser omits it. */
  accuracyMeters: number | null;
  /** `GeolocationPosition.timestamp` (ms since epoch). */
  timestampMs?: number;
}

/**
 * Converts nullable coordinates stored on an attendance record into the
 * device-coordinate shape consumed by the scan map.
 *
 * Invalid values are treated as missing so an incomplete API row cannot
 * render a misleading map pin. GPS accuracy is optional because older rows
 * may not have captured it.
 */
export function toDeviceCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  accuracyMeters: number | null | undefined,
): DeviceCoordinates | null {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracyMeters:
      accuracyMeters != null && Number.isFinite(accuracyMeters) && accuracyMeters >= 0
        ? Math.round(accuracyMeters)
        : null,
  };
}

export type GeolocationFailureReason =
  'insecure' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export type GeolocationReadResult =
  | { ok: true; coords: DeviceCoordinates }
  | { ok: false; reason: GeolocationFailureReason; coords?: DeviceCoordinates };

const DEFAULT_TIMEOUT_MS = 8_000;

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: DEFAULT_TIMEOUT_MS,
  maximumAge: 0,
};

/**
 * Reads the student's current position for the attendance geofence check
 * (FR-02). Uses the first available fix so submit is not delayed.
 * Never throws.
 */
export function getCurrentCoordinates(
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GeolocationReadResult> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: 'insecure' });
  }

  if (!('geolocation' in navigator) || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  const geo = navigator.geolocation;
  const canWatch = typeof geo.watchPosition === 'function';
  const options: PositionOptions = {
    ...GEO_OPTIONS,
    timeout: timeoutMs,
  };

  return new Promise((resolve) => {
    let settled = false;
    let best: DeviceCoordinates | null = null;
    let lastFailureReason: GeolocationFailureReason | null = null;
    let watchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: GeolocationReadResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (watchId != null && typeof geo.clearWatch === 'function') {
        geo.clearWatch(watchId);
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const consider = (position: GeolocationPosition) => {
      const next = coordsFromPosition(position);
      if (!best || isBetterFix(next, best)) {
        best = next;
      }
      if (best) {
        finish({ ok: true, coords: best });
      }
    };

    const fail = (error?: GeolocationPositionError) => {
      const reason = reasonFromPositionError(error);
      lastFailureReason = reason;
      if (reason === 'denied') {
        finish({ ok: false, reason: 'denied', coords: best ?? undefined });
        return;
      }
      if (!canWatch) {
        finish(finishFromBest(best, reason));
      }
    };

    timeoutId = setTimeout(() => {
      finish(finishFromBest(best, lastFailureReason ?? 'timeout'));
    }, timeoutMs);

    geo.getCurrentPosition(consider, fail, options);

    if (!canWatch) {
      return;
    }

    watchId = geo.watchPosition(consider, fail, options);
  });
}

/**
 * Live GPS feed for the scan map. Returns a stop function.
 * Emits every new reading so the pin can move.
 */
export function watchDeviceLocation(onChange: (result: GeolocationReadResult) => void): () => void {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    onChange({ ok: false, reason: 'insecure' });
    return () => undefined;
  }

  if (!('geolocation' in navigator) || !navigator.geolocation) {
    onChange({ ok: false, reason: 'unsupported' });
    return () => undefined;
  }

  const geo = navigator.geolocation;
  if (typeof geo.watchPosition !== 'function') {
    geo.getCurrentPosition(
      (position) => onChange({ ok: true, coords: coordsFromPosition(position) }),
      (error) => onChange({ ok: false, reason: reasonFromPositionError(error) }),
      GEO_OPTIONS,
    );
    return () => undefined;
  }

  const watchId = geo.watchPosition(
    (position) => onChange({ ok: true, coords: coordsFromPosition(position) }),
    (error) => onChange({ ok: false, reason: reasonFromPositionError(error) }),
    GEO_OPTIONS,
  );

  return () => {
    if (typeof geo.clearWatch === 'function') {
      geo.clearWatch(watchId);
    }
  };
}

function finishFromBest(
  best: DeviceCoordinates | null,
  fallback: GeolocationFailureReason,
): GeolocationReadResult {
  if (best) {
    return { ok: true, coords: best };
  }
  return { ok: false, reason: fallback };
}

function coordsFromPosition(position: GeolocationPosition): DeviceCoordinates {
  const accuracy = position.coords.accuracy;
  const timestamp = position.timestamp;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    timestampMs: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
}

function isBetterFix(next: DeviceCoordinates, current: DeviceCoordinates): boolean {
  if (next.accuracyMeters == null) {
    return current.accuracyMeters == null;
  }
  if (current.accuracyMeters == null) {
    return true;
  }
  return next.accuracyMeters < current.accuracyMeters;
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
