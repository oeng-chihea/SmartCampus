import { StatCard } from '../shared/components/stat-card/stat-card.model';
import dashboardAttendanceMock from '../../assets/mock-data/dashboard-attendance.json';

/** Monthly attendance analysis point (Jan → Dec) */
export interface MonthlyAttendancePoint {
  month: string;
  presentRate: number;
  present: number;
  late: number;
  absent: number;
  outsideLocation: number;
}

/** Recent scan row for admin / teacher review (FR-07) */
export interface RecentScan {
  id: string;
  student: string;
  studentId: string;
  session: string;
  location: string;
  submittedAt: string;
  recordedAt: string;
  status: 'Present' | 'Late' | 'Absent' | 'Outside Location';
  distanceMeters: number | null;
}

export interface QuickFilter {
  studentIdPlaceholder: string;
  statusOptions: string[];
}

export interface AdminDashboard {
  title: string;
  subtitle: string;
  summaryCards: StatCard[];
  monthlyTrend: MonthlyAttendancePoint[];
  trendYear: number;
  recentScans: RecentScan[];
  quickFilter: QuickFilter;
}

interface DashboardAttendanceMock {
  year: number;
  monthlyTrend: MonthlyAttendancePoint[];
  recentScans: RecentScan[];
}

const mock = dashboardAttendanceMock as DashboardAttendanceMock;

export class DashboardService {
  getAdminDashboard(): AdminDashboard {
    return {
      title: 'SmartCampus Attendance System',
      subtitle:
        'Live view of identity-verified scans, time stamps, location checks, and attendance status.',
      summaryCards: [
        {
          label: 'Registered students',
          value: '1,284',
          helper: 'Authorised student accounts',
          icon: 'students',
          tone: 'blue',
        },
        {
          label: 'Present today',
          value: '1,087',
          helper: 'Valid scans inside approved areas',
          icon: 'present',
          tone: 'green',
        },
        {
          label: 'Attendance rate',
          value: '87%',
          helper: '161 late · 36 outside location',
          icon: 'attendance',
          tone: 'amber',
        },
        {
          label: 'Open sessions',
          value: '12',
          helper: 'Active scan codes for classes',
          icon: 'sessions',
          tone: 'violet',
        },
      ],
      trendYear: mock.year,
      monthlyTrend: mock.monthlyTrend,
      recentScans: mock.recentScans,
      quickFilter: {
        studentIdPlaceholder: 'Search by student ID',
        statusOptions: ['Present', 'Late', 'Absent', 'Outside Location'],
      },
    };
  }
}
