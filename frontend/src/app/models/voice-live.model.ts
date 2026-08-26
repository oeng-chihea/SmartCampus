export type CampusVoicePage =
  | 'dashboard'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'students'
  | 'reports'
  | 'scan';

export type VoiceLiveStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

export interface GeminiLiveConnectConfig {
  responseModalities: string[];
  systemInstruction: string;
  tools: Array<{ functionDeclarations: unknown[] }>;
  sessionResumption: { handle?: string };
  realtimeInputConfig?: {
    automaticActivityDetection?: {
      startOfSpeechSensitivity?: string;
      endOfSpeechSensitivity?: string;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
    };
  };
}

export interface VoiceLiveToken {
  token: string;
  model: string;
  websocketUrl: string;
  config: GeminiLiveConnectConfig;
  expireTime: string | null;
  newSessionExpireTime: string | null;
}

export interface VoiceToolResult {
  ok: boolean;
  message: string;
  item_summary?: string;
  spokenSummary?: string;
  confirmation_required?: boolean;
  matches?: Array<{ id: string; label: string }>;
  selected_id?: string;
  stop_requested?: boolean;
  attendance?: CampusVoiceAttendanceSummary;
  records?: CampusRecordsSnapshot['attendance']['records'];
  snapshot?: CampusRecordsSnapshot;
}

export interface CampusVoiceAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  inside: number;
  outside: number;
}

export interface CampusRecordsQuery {
  scope?: 'all' | 'dashboard' | 'attendance' | 'locations' | 'sessions' | 'students';
  query?: string;
  attendance_status?: 'all' | 'Present' | 'Absent';
  location_status?: 'all' | 'inside' | 'outside';
  date_filter?: 'all' | 'today' | 'yesterday' | 'week';
  building?: string;
  session_id?: string;
  session_query?: string;
}

export interface CampusVoiceAttendanceRow {
  student: string;
  studentId: string;
  session: string;
  sessionId: string;
  location: string;
  scannedLocation: string | null;
  recordedAt: string;
  status: string;
  attendanceStatus: string;
  distanceMeters: number | null;
}

export interface CampusVoiceVisitRow {
  student: string;
  studentId: string;
  session: string;
  locationName: string;
  building: string;
  room: string;
  scannedLocation: string | null;
  recordedAt: string;
  status: string;
  distanceMeters: number | null;
}

export interface CampusVoiceZoneRow {
  id: string;
  name: string;
  building: string;
  room: string;
  radiusMeters: number;
  status: string;
  sessionsUsing: number;
}

export interface CampusVoiceSessionRow {
  id: string;
  title: string;
  status: string;
  locationName: string;
  teacherName: string;
  openedAt: string;
  dueAt: string | null;
  closedAt: string | null;
  recorded?: boolean;
  duePassed?: boolean;
}

export interface CampusVoiceStudentRow {
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

export interface CampusRecordsSnapshot {
  generatedAt: string;
  filtered: boolean;
  spokenSummary: string;
  dashboard: {
    cards: Array<{ label: string; value: string; helper: string }>;
    trendYear: number;
    monthlyTrend: Array<{
      month: string;
      presentRate: number;
      present: number;
      absent: number;
      outsideLocation: number;
    }>;
    recentScans: Array<{
      student: string;
      studentId: string;
      session: string;
      location: string;
      status: string;
      distanceMeters: number | null;
      recordedAt: string;
    }>;
  };
  attendance: CampusVoiceAttendanceSummary & {
    records: CampusVoiceAttendanceRow[];
  };
  locations: {
    total: number;
    inside: number;
    outside: number;
    visits: CampusVoiceVisitRow[];
    zones: CampusVoiceZoneRow[];
  };
  sessions: {
    total: number;
    open: number;
    closed: number;
    items: CampusVoiceSessionRow[];
  };
  students: {
    total: number;
    loginEnabled: number;
    loginDisabled: number;
    items: CampusVoiceStudentRow[];
  };
}

export interface VoiceSelectArgs {
  row_id?: string;
  query?: string;
  position?: number;
  last_position?: boolean;
}

export interface VoiceControlArgs {
  action:
    | 'refresh'
    | 'search'
    | 'clear_search'
    | 'clear_filters'
    | 'export'
    | 'open_create'
    | 'status'
    | 'filter';
  query?: string;
  status_filter?: string;
  attendance_status?: string;
  date_filter?: string;
  building?: string;
}

export interface VoiceActArgs extends VoiceSelectArgs {
  action:
    | 'show_qr'
    | 'edit'
    | 'close'
    | 'delete'
    | 'toggle_login'
    | 'open_add_student'
    | 'mark_present';
  /** Student scan: mark every eligible live class in one call. */
  all?: boolean;
}

export interface VoiceConfirmArgs {
  confirm?: boolean;
  decision?: string;
}

export interface VoicePageHandler {
  page: CampusVoicePage;
  startContext(): string;
  control(args: VoiceControlArgs): Promise<VoiceToolResult>;
  select(args: VoiceSelectArgs): Promise<VoiceToolResult>;
  act(args: VoiceActArgs): Promise<VoiceToolResult>;
  confirm(args: VoiceConfirmArgs): Promise<VoiceToolResult>;
}
