export function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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

/**
 * Scanned-at table cell: place name first, GPS underneath.
 * Falls back to coordinates alone when reverse geocode is missing.
 */
export function formatScannedAtCell(
  scannedLocation: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { title: string; subtitle?: string } {
  const coordinates = formatScanCoordinates(latitude, longitude);
  const place = scannedLocation?.trim();
  if (place) {
    return {
      title: place,
      subtitle: coordinates === '—' ? undefined : coordinates,
    };
  }
  return { title: coordinates };
}
