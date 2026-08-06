/** Application roles (role-based access) */
export const USER_ROLES = {
  admin: 'admin',
  teacher: 'teacher',
  student: 'student',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
