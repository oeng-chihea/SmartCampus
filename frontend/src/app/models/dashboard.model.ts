import { AttendanceStatus } from './attendance.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

/** Monthly attendance analysis point (Jan → Dec). */
export interface MonthlyAttendancePoint {
  month: string;
  presentRate: number;
  present: number;
  absent: number;
  outsideLocation: number;
}

/** Recent scan row for admin / teacher review (FR-07). */
export interface RecentScan {
  id: string;
  student: string;
  studentId: string;
  session: string;
  location: string;
  submittedAt: string;
  recordedAt: string;
  status: AttendanceStatus;
  distanceMeters: number | null;
}

export interface AdminDashboard {
  title: string;
  subtitle: string;
  summaryCards: StatCard[];
  monthlyTrend: MonthlyAttendancePoint[];
  trendYear: number;
  recentScans: RecentScan[];
}
