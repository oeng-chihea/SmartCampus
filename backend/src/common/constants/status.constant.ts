/** Location result for a student's attendance GPS check. */
export const ATTENDANCE_LOCATION_STATUS = {
  inside: 'Inside',
  outsideLocation: 'Outside Location',
} as const;

export type AttendanceLocationStatus =
  (typeof ATTENDANCE_LOCATION_STATUS)[keyof typeof ATTENDANCE_LOCATION_STATUS];

/** Attendance check-in result (independent from the geofence result). */
export const ATTENDANCE_STATUS = {
  present: 'Present',
  absent: 'Absent',
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

/** Alias kept for response contracts that describe the check-in dimension. */
export type AttendanceCheckInStatus = AttendanceStatus;

/** Geofence filter on POST /attendance/admin (`status`). */
export const ADMIN_LOCATION_STATUS_FILTERS = ['inside', 'outside'] as const;
export type AdminLocationStatusFilter =
  (typeof ADMIN_LOCATION_STATUS_FILTERS)[number];

/** Check-in filter on POST /attendance/admin (`attendanceStatus`). */
export const ADMIN_ATTENDANCE_STATUS_FILTERS = [
  ATTENDANCE_STATUS.present,
  ATTENDANCE_STATUS.absent,
] as const;

/** Live admin/teacher location-status values returned by the API. */
export const ADMIN_LOCATION_STATUS_OPTIONS: AttendanceLocationStatus[] = [
  ATTENDANCE_LOCATION_STATUS.inside,
  ATTENDANCE_LOCATION_STATUS.outsideLocation,
];

/** Live admin/teacher attendance-status values returned by the API. */
export const ADMIN_ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = [
  ATTENDANCE_STATUS.present,
  ATTENDANCE_STATUS.absent,
];
