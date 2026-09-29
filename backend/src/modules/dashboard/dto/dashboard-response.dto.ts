import { AttendanceLocationStatus } from '../../../common/constants/status.constant';

export interface DashboardStatCardDto {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: string;
}

export interface MonthlyAttendancePointDto {
  month: string;
  presentRate: number;
  present: number;
  absent: number;
  outsideLocation: number;
}

export interface RecentScanDto {
  id: string;
  student: string;
  studentId: string;
  session: string;
  location: string;
  submittedAt: string;
  recordedAt: string;
  status: AttendanceLocationStatus | null;
  distanceMeters: number | null;
}

export interface AdminDashboardResponseDto {
  title: string;
  subtitle: string;
  summaryCards: DashboardStatCardDto[];
  monthlyTrend: MonthlyAttendancePointDto[];
  trendYear: number;
  recentScans: RecentScanDto[];
}
