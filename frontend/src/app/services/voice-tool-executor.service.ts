import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { APP_ROUTES } from '../core/constants/app-routes';
import { isAffirmativeDecision } from '../core/utils/voice-row-match.util';
import {
  CampusRecordsQuery,
  CampusRecordsSnapshot,
  CampusVoicePage,
  VoiceActArgs,
  VoiceConfirmArgs,
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../models/voice-live.model';
import { AuthService } from './auth.service';
import { VoicePageRegistry } from './voice-page-registry.service';

const PAGE_PATH: Record<CampusVoicePage, string> = {
  dashboard: `/${APP_ROUTES.dashboard}`,
  attendance: `/${APP_ROUTES.attendance}`,
  locations: `/${APP_ROUTES.locations}`,
  sessions: `/${APP_ROUTES.sessions}`,
  students: `/${APP_ROUTES.students}`,
  reports: `/${APP_ROUTES.reports}`,
  scan: `/${APP_ROUTES.studentScan}`,
};

const PAGE_LABEL: Record<CampusVoicePage, string> = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  locations: 'Locations',
  sessions: 'Sessions',
  students: 'Students',
  reports: 'Reports',
  scan: 'Mark attendance',
};

function fail(message: string): VoiceToolResult {
  return { ok: false, message };
}

function ok(message: string, extra: Partial<VoiceToolResult> = {}): VoiceToolResult {
  return { ok: true, message, ...extra };
}

@Injectable({ providedIn: 'root' })
export class VoiceToolExecutor {
  private readonly router = inject(Router);
  private readonly pages = inject(VoicePageRegistry);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<VoiceToolResult> {
    switch (name) {
      case 'navigate_campus':
        return this.navigate(String(args['page'] ?? ''));
      case 'read_campus_records':
        return this.readCampusRecords(args as CampusRecordsQuery);
      case 'control_page_view':
        return this.control(args as unknown as VoiceControlArgs);
      case 'select_row':
        return this.select(args as unknown as VoiceSelectArgs);
      case 'act_on_row':
        return this.act(args as unknown as VoiceActArgs);
      case 'confirm_pending_voice_action':
        return this.confirm(args as unknown as VoiceConfirmArgs);
      case 'stop_voice_conversation':
        return ok('Stopping the voice conversation.', { stop_requested: true });
      default:
        return fail(`Unsupported voice tool: ${name || 'unknown'}.`);
    }
  }

  async readCampusRecords(query: CampusRecordsQuery): Promise<VoiceToolResult> {
    const body: CampusRecordsQuery = {};
    if (query.scope && query.scope !== 'all') {
      body.scope = query.scope;
    }
    const search = String(query.query ?? '').trim();
    if (search) {
      body.query = search;
    }
    if (query.attendance_status && query.attendance_status !== 'all') {
      body.attendance_status = query.attendance_status;
    }
    if (query.location_status && query.location_status !== 'all') {
      body.location_status = query.location_status;
    }
    if (query.date_filter && query.date_filter !== 'all') {
      body.date_filter = query.date_filter;
    }
    const building = String(query.building ?? '').trim();
    if (building) {
      body.building = building;
    }
    const sessionId = String(query.session_id ?? '').trim();
    if (sessionId) {
      body.session_id = sessionId;
    }
    const sessionQuery = String(query.session_query ?? '').trim();
    if (sessionQuery) {
      body.session_query = sessionQuery;
    }

    try {
      const snapshot = await firstValueFrom(
        this.http.post<CampusRecordsSnapshot>(
          `${environment.apiBaseUrl}${API_ENDPOINTS.aiCampusRecords}`,
          body,
          { headers: authTokenHeaders(this.auth.getAccessToken()) },
        ),
      );
      return ok(snapshot.spokenSummary, {
        spokenSummary: snapshot.spokenSummary,
        item_summary: snapshot.spokenSummary,
        snapshot,
        records: snapshot.attendance.records,
        attendance: {
          total: snapshot.attendance.total,
          present: snapshot.attendance.present,
          absent: snapshot.attendance.absent,
          inside: snapshot.attendance.inside,
          outside: snapshot.attendance.outside,
        },
      });
    } catch {
      return fail('Could not read campus records. Try again.');
    }
  }

  async navigate(pageRaw: string): Promise<VoiceToolResult> {
    const page = pageRaw.trim().toLowerCase() as CampusVoicePage;
    if (!PAGE_PATH[page]) {
      return fail(
        'I can open Dashboard, Students, Attendance, Locations, Sessions, or Reports.',
      );
    }
    if (this.auth.role() === 'student' && page !== 'scan') {
      return fail('Students stay on Mark attendance. I cannot open teacher pages.');
    }
    const opened = await this.router.navigateByUrl(PAGE_PATH[page]);
    if (!opened) {
      return fail(`Could not open ${PAGE_LABEL[page]}.`);
    }
    return ok(`Opened ${PAGE_LABEL[page]}.`);
  }

  private requireHandler(): VoicePageHandlerResult {
    const handler = this.pages.current();
    if (!handler) {
      return {
        error: fail(
          'Open Dashboard, Attendance, Locations, or Sessions first, then say the command again.',
        ),
      };
    }
    return { handler };
  }

  private async control(args: VoiceControlArgs): Promise<VoiceToolResult> {
    const required = this.requireHandler();
    if (required.error) {
      return required.error;
    }
    return required.handler.control(args);
  }

  private async select(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const required = this.requireHandler();
    if (required.error) {
      return required.error;
    }
    return required.handler.select(args);
  }

  private async act(args: VoiceActArgs): Promise<VoiceToolResult> {
    const required = this.requireHandler();
    if (required.error) {
      return required.error;
    }
    return required.handler.act(args);
  }

  private async confirm(args: VoiceConfirmArgs): Promise<VoiceToolResult> {
    const required = this.requireHandler();
    if (required.error) {
      return required.error;
    }
    const decision =
      typeof args.confirm === 'boolean'
        ? args.confirm
        : isAffirmativeDecision(args.decision);
    if (decision === null) {
      return fail('Say yes to confirm or no to cancel.');
    }
    return required.handler.confirm({ confirm: decision, decision: args.decision });
  }
}

type VoicePageHandlerResult =
  | { handler: NonNullable<ReturnType<VoicePageRegistry['current']>>; error?: undefined }
  | { handler?: undefined; error: VoiceToolResult };

function authTokenHeaders(token: string | null): HttpHeaders {
  if (!token) {
    return new HttpHeaders();
  }
  return new HttpHeaders({ Authorization: `Bearer ${token}` });
}
