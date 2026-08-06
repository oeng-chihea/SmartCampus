import { Routes } from '@angular/router';
import { StudentScanComponent } from '../features/attendance/pages/student-scan/student-scan.component';

export const attendanceRoutes: Routes = [
  {
    path: 'scan',
    component: StudentScanComponent,
  },
];
