export type AdminNavIcon =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'reports';

export interface AdminNavItem {
  label: string;
  icon: AdminNavIcon;
  path: string;
}

/** Attendance-first admin navigation (FR-aligned; no requests/courses CRM) */
export const ADMIN_NAVIGATION: AdminNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
  { label: 'Students', icon: 'students', path: '/students' },
  { label: 'Attendance', icon: 'attendance', path: '/attendance' },
  { label: 'Locations', icon: 'locations', path: '/locations' },
  { label: 'Sessions', icon: 'sessions', path: '/sessions' },
  { label: 'Reports', icon: 'reports', path: '/reports' },
];
