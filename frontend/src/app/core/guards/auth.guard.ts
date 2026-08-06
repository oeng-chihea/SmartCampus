import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authLoginPath } from '../constants/app-routes';
import { UserRole } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

/**
 * Pick a role-specific login when a guard blocks access.
 * Prefer a single-role target; for admin+teacher shell use admin login.
 */
function loginPathForGuardRoles(roles: UserRole[]): string {
  if (roles.length === 1) {
    return authLoginPath(roles[0]);
  }
  if (roles.includes('student') && !roles.includes('admin') && !roles.includes('teacher')) {
    return authLoginPath('student');
  }
  if (roles.includes('admin')) {
    return authLoginPath('admin');
  }
  if (roles.includes('teacher')) {
    return authLoginPath('teacher');
  }
  return authLoginPath('student');
}

/** Requires an authenticated session (FR-01). */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Generic auth wall — student portal is the safest default (no role chooser).
  return router.createUrlTree([authLoginPath('student')]);
};

/** Requires one of the given roles. */
export const roleGuard = (roles: UserRole[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree([loginPathForGuardRoles(roles)]);
    }

    if (auth.hasRole(...roles)) {
      return true;
    }

    const role = auth.role();
    return router.createUrlTree([
      role ? auth.homePathForRole(role) : authLoginPath('student'),
    ]);
  };
};

/** Sends already-logged-in users away from the login pages. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const role = auth.role();
  return router.createUrlTree([role ? auth.homePathForRole(role) : '/dashboard']);
};
