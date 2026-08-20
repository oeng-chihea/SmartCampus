/** Attendance statuses (FR-06) */
export const ATTENDANCE_STATUS = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  outsideLocation: 'Outside Location',
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

/** Did the student check in on time? Derived from scan status. */
export type AttendanceCheckInStatus =
  | typeof ATTENDANCE_STATUS.present
  | typeof ATTENDANCE_STATUS.absent;

/** Geofence filter on POST /attendance/admin (`status`). */
export const ADMIN_LOCATION_STATUS_FILTERS = ['inside', 'outside'] as const;
export type AdminLocationStatusFilter =
  (typeof ADMIN_LOCATION_STATUS_FILTERS)[number];

/** Check-in filter on POST /attendance/admin (`attendanceStatus`). */
export const ADMIN_ATTENDANCE_STATUS_FILTERS = [
  ATTENDANCE_STATUS.present,
  ATTENDANCE_STATUS.absent,
] as const;

/** Live admin/teacher location-status filter values. */
export const ADMIN_ATTENDANCE_STATUS_OPTIONS: AttendanceStatus[] = [
  ATTENDANCE_STATUS.present,
  ATTENDANCE_STATUS.absent,
  ATTENDANCE_STATUS.outsideLocation,
];
