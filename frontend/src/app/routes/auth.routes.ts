import { Routes } from '@angular/router';

/**
 * Role-specific sign-in only (no shared chooser page):
 * - /auth/admin
 * - /auth/teacher
 * - /auth/student
 *
 * Open the correct URL manually. Legacy /auth/login/<role> redirects to /auth/<role>.
 * Bare /auth/login is not a chooser (invalid portal message, no role links).
 */
export const authRoutes: Routes = [
  {
    path: 'login/admin',
    pathMatch: 'full',
    redirectTo: '/auth/admin',
  },
  {
    path: 'login/teacher',
    pathMatch: 'full',
    redirectTo: '/auth/teacher',
  },
  {
    path: 'login/student',
    pathMatch: 'full',
    redirectTo: '/auth/student',
  },
  {
    path: ':role',
    loadComponent: () =>
      import('../features/auth/pages/login/login.component').then(
        (module) => module.LoginComponent,
      ),
  },
];
