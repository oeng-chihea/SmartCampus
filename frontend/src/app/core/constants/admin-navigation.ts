export type AdminNavIcon =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'locations'
  | 'sessions';

export interface AdminNavItem {
  label: string;
  icon: AdminNavIcon;
  path: string;
}

/** Attendance-first teacher (administration) navigation */
export const ADMIN_NAVIGATION: AdminNavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
  { label: 'Students', icon: 'students', path: '/students' },
  { label: 'Attendance', icon: 'attendance', path: '/attendance' },
  // Temporarily hidden with the page route; preserve this entry for re-enabling.
  // { label: 'Locations', icon: 'locations', path: '/locations' },
  { label: 'Sessions', icon: 'sessions', path: '/sessions' },
];
