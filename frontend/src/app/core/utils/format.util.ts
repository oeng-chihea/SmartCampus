export function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Geofence status shown in tables and record detail.
 * Stored `Present` means inside the zone; attendance check-in stays Present.
 */
export function formatGeofenceStatus(status: string): string {
  return status === 'Present' ? 'Inside' : status;
}

export function geofenceBadgeVariant(status: string): string {
  return formatGeofenceStatus(status).toLowerCase().replace(/\s+/g, '-');
}

/** Place name for Scanned at. Never falls back to raw coordinates. */
export function formatScannedAtPlace(
  scannedLocation: string | null | undefined,
  fallbackName?: string | null,
): string {
  const place = scannedLocation?.trim();
  if (place) {
    return place;
  }
  const fallback = fallbackName?.trim();
  if (fallback) {
    return fallback;
  }
  return '—';
}

/**
 * Campus location display: `Building A-Room 201`
 * Accepts either building + room parts, or a stored name like `Building A, Room 201`.
 */
export function formatCampusLocationLabel(
  buildingOrName: string,
  room?: string | null,
): string {
  if (room != null && String(room).trim().length > 0) {
    return `${buildingOrName.trim()}-Room ${String(room).trim()}`;
  }

  const name = buildingOrName.trim();
  // "Building A, Room 201" → "Building A-Room 201"
  return name.replace(/,\s*Room\s+/i, '-Room ');
}

/**
 * Student scan / mark-present GPS for table cells.
 * Six decimal places (~0.1 m) so the point stays exact; missing values → "—".
 */
export function formatScanCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string {
  if (latitude == null || longitude == null) {
    return '—';
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function formatScanAccuracy(
  accuracyMeters: number | null | undefined,
): string | null {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters)) {
    return null;
  }
  return `±${Math.round(accuracyMeters)} m`;
}

/** Table chip for phone GPS accuracy (shown beside coordinates). */
export function formatScanAccuracyChip(
  accuracyMeters: number | null | undefined,
): { label: string; title: string } | undefined {
  const label = formatScanAccuracy(accuracyMeters);
  if (!label) {
    return undefined;
  }
  return {
    label,
    title: `Phone GPS accuracy ${label}`,
  };
}

/** Distance-from-zone cell: `3046 m`, or `—` when GPS was not stored. */
export function formatDistanceMeters(
  distanceMeters: number | null | undefined,
): string {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) {
    return '—';
  }
  return `${Math.round(distanceMeters)} m`;
}

/** Badge token for the Distance column (`distance` | `empty`). */
export function distanceBadgeVariant(
  distanceMeters: number | null | undefined,
): 'distance' | 'empty' {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) {
    return 'empty';
  }
  return 'distance';
}

/**
 * Diagnostic GPS dump for the scan card / blocked dialog.
 * Same four fields a reviewer asks for when a pin looks "wrong".
 */
export function formatGpsReading(coords: {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestampMs?: number | null;
}): string {
  const accuracy =
    coords.accuracyMeters != null && Number.isFinite(coords.accuracyMeters)
      ? `${Math.round(coords.accuracyMeters)}m`
      : 'unknown';
  const timestamp =
    coords.timestampMs != null && Number.isFinite(coords.timestampMs)
      ? new Date(coords.timestampMs).toISOString()
      : 'unknown';
  return [
    `latitude: ${coords.latitude.toFixed(6)}`,
    `longitude: ${coords.longitude.toFixed(6)}`,
    `accuracy: ${accuracy}`,
    `timestamp: ${timestamp}`,
  ].join('\n');
}

/**
 * Scanned-at table cell: place name first, coordinates underneath,
 * GPS accuracy as a separate chip so `±16 m` is easy to spot.
 * Falls back to the campus zone name when reverse geocode is missing.
 */
export function formatScannedAtCell(
  scannedLocation: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  accuracyMeters?: number | null,
  fallbackName?: string | null,
): {
  title: string;
  subtitle?: string;
  chip?: { label: string; title: string };
  truncate?: boolean;
  titleAttr?: string;
} {
  const coordinates = formatScanCoordinates(latitude, longitude);
  const subtitle = coordinates === '—' ? undefined : coordinates;
  const chip = formatScanAccuracyChip(accuracyMeters);
  const place = formatScannedAtPlace(scannedLocation, fallbackName);
  if (place !== '—') {
    return {
      title: place,
      subtitle,
      chip,
      truncate: true,
      titleAttr: place,
    };
  }
  if (subtitle) {
    return { title: subtitle, chip };
  }
  return { title: chip?.label ?? '—' };
}
