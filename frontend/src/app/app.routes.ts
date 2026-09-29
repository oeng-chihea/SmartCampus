import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    loadChildren: () => import('./routes/auth.routes').then((module) => module.authRoutes),
  },
  {
    path: 'student',
    canActivate: [authGuard, roleGuard(['student'])],
    loadChildren: () =>
      import('./routes/attendance.routes').then((module) => module.attendanceRoutes),
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard(['teacher'])],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./routes/dashboard.routes').then((module) => module.dashboardRoutes),
      },
      {
        path: 'students',
        loadChildren: () =>
          import('./routes/students.routes').then((module) => module.studentsRoutes),
      },
      {
        path: 'attendance',
        loadChildren: () =>
          import('./routes/admin-attendance.routes').then((module) => module.adminAttendanceRoutes),
      },
      // Temporarily hidden. Keep the route and page implementation available
      // in source, but do not register the Locations page in the application.
      // {
      //   path: 'locations',
      //   loadChildren: () =>
      //     import('./routes/locations.routes').then((module) => module.locationsRoutes),
      // },
      {
        path: 'sessions',
        loadChildren: () =>
          import('./routes/sessions.routes').then((module) => module.sessionsRoutes),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
