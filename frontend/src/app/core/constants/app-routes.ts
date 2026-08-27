export const APP_ROUTES = {
  auth: 'auth',
  /** Role-specific sign-in only (no shared chooser). */
  authTeacher: 'auth/teacher',
  authStudent: 'auth/student',
  dashboard: 'dashboard',
  students: 'students',
  attendance: 'attendance',
  locations: 'locations',
  sessions: 'sessions',
  studentScan: 'student/scan',
  studentHistory: 'student/history',
} as const;

export type AuthLoginRole = 'teacher' | 'student';

/**
 * Absolute sign-in path for a role.
 * Example: authLoginPath('teacher') → `/auth/teacher`
 */
export function authLoginPath(role: AuthLoginRole): string {
  return `/auth/${role}`;
}
