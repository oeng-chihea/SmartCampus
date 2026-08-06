export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Present for student accounts — links scans to identity (FR-01/FR-02) */
  studentId?: string;
}
