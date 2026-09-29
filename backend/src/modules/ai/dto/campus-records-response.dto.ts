import {
  AttendanceCheckInStatus,
  AttendanceLocationStatus,
} from '../../../common/constants/status.constant';

export interface CampusVoiceAttendanceRowDto {
  student: string;
  studentId: string;
  session: string;
  sessionId: string;
  location: string;
  scannedLocation: string | null;
  recordedAt: string;
  status: AttendanceLocationStatus | null;
  attendanceStatus: AttendanceCheckInStatus;
  distanceMeters: number | null;
}

export interface CampusVoiceVisitRowDto {
  student: string;
  studentId: string;
  session: string;
  locationName: string;
  building: string;
  room: string;
  scannedLocation: string | null;
  recordedAt: string;
  status: AttendanceLocationStatus | null;
  distanceMeters: number | null;
}

export interface CampusVoiceZoneRowDto {
  id: string;
  name: string;
  building: string;
  room: string;
  radiusMeters: number;
  status: string;
  sessionsUsing: number;
}

export interface CampusVoiceSessionRowDto {
  id: string;
  title: string;
  status: string;
  locationName: string;
  teacherName: string;
  openedAt: string;
  dueAt: string | null;
  closedAt: string | null;
  /** Student voice only: this signed-in student already has a scan for the class. */
  recorded?: boolean;
  /** Student voice only: due time has passed so mark present is blocked. */
  duePassed?: boolean;
}

export interface CampusVoiceStudentRowDto {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  loginEnabled: boolean;
  hasAccount: boolean;
  attendanceRate: number;
  status: string;
}

export interface CampusVoiceDashboardCardDto {
  label: string;
  value: string;
  helper: string;
}

export interface CampusVoiceMonthlyPointDto {
  month: string;
  presentRate: number;
  present: number;
  absent: number;
  outsideLocation: number;
}

export interface CampusVoiceRecentScanDto {
  student: string;
  studentId: string;
  session: string;
  location: string;
  status: AttendanceLocationStatus | null;
  distanceMeters: number | null;
  recordedAt: string;
}

export interface CampusVoiceDashboardSummaryDto {
  cards: CampusVoiceDashboardCardDto[];
  trendYear: number;
  monthlyTrend: CampusVoiceMonthlyPointDto[];
  recentScans: CampusVoiceRecentScanDto[];
}

export interface CampusVoiceAttendanceSummaryDto {
  total: number;
  present: number;
  absent: number;
  inside: number;
  outside: number;
  records: CampusVoiceAttendanceRowDto[];
}

export interface CampusVoiceLocationSummaryDto {
  total: number;
  inside: number;
  outside: number;
  visits: CampusVoiceVisitRowDto[];
  zones: CampusVoiceZoneRowDto[];
}

export interface CampusVoiceSessionSummaryDto {
  total: number;
  open: number;
  closed: number;
  items: CampusVoiceSessionRowDto[];
}

export interface CampusVoiceStudentSummaryDto {
  total: number;
  loginEnabled: number;
  loginDisabled: number;
  items: CampusVoiceStudentRowDto[];
}

export interface CampusRecordsResponseDto {
  generatedAt: string;
  filtered: boolean;
  spokenSummary: string;
  dashboard: CampusVoiceDashboardSummaryDto;
  attendance: CampusVoiceAttendanceSummaryDto;
  locations: CampusVoiceLocationSummaryDto;
  sessions: CampusVoiceSessionSummaryDto;
  students: CampusVoiceStudentSummaryDto;
}
