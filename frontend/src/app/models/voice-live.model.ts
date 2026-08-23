export type CampusVoicePage =
  | 'dashboard'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'students'
  | 'reports';

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
  inputAudioTranscription: Record<string, unknown>;
  outputAudioTranscription: Record<string, unknown>;
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
  confirmation_required?: boolean;
  matches?: Array<{ id: string; label: string }>;
  selected_id?: string;
  stop_requested?: boolean;
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
    | 'open_add_student';
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
