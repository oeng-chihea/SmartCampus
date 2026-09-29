/** Geofence status label. Absent records have no location result. */
export function formatGeofenceStatus(status: string | null | undefined): string {
  return status?.trim() || '—';
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
  return name.replace(/,\s*Room\s+/i, '-Room ');
}
