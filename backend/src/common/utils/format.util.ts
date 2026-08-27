/** Geofence status label. Stored `Present` means inside the zone. */
export function formatGeofenceStatus(status: string): string {
  return status === 'Present' ? 'Inside' : status;
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
