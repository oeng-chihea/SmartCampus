import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { authLoginPath } from '../constants/app-routes';
import { UserRole } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';

/**
 * Pick a role-specific login when a guard blocks access.
 * Prefer a single-role target; for the staff shell use teacher login.
 */
function loginPathForGuardRoles(roles: UserRole[]): string {
  if (roles.length === 1) {
    return authLoginPath(roles[0]);
  }
  if (roles.includes('student') && !roles.includes('teacher')) {
    return authLoginPath('student');
  }
  if (roles.includes('teacher')) {
    return authLoginPath('teacher');
  }
  return authLoginPath('student');
}

/** Keep deep-link query (e.g. ?payload=…) so Camera → login → scan still works. */
function loginTreeWithReturn(
  router: Router,
  loginPath: string,
  attemptedUrl: string,
): UrlTree {
  return router.createUrlTree([loginPath], {
    queryParams: attemptedUrl ? { returnUrl: attemptedUrl } : undefined,
  });
}

/** Requires an authenticated session (FR-01). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Generic auth wall — student portal is the safest default (no role chooser).
  return loginTreeWithReturn(router, authLoginPath('student'), state.url);
};

/** Requires one of the given roles. */
export const roleGuard = (roles: UserRole[]): CanActivateFn => {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return loginTreeWithReturn(
        router,
        loginPathForGuardRoles(roles),
        state.url,
      );
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
