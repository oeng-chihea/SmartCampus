import { Routes } from '@angular/router';

/**
 * Role-specific sign-in only (no shared chooser page):
 * - /auth/teacher  (campus administration)
 * - /auth/student
 *
 * Open the correct URL manually. Legacy /auth/login/<role> and /auth/admin
 * redirect to the teacher portal. Bare /auth/login is not a chooser.
 */
export const authRoutes: Routes = [
  {
    path: 'admin',
    pathMatch: 'full',
    redirectTo: '/auth/teacher',
  },
  {
    path: 'login/admin',
    pathMatch: 'full',
    redirectTo: '/auth/teacher',
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
