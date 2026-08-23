import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { APP_ROUTES } from '../core/constants/app-routes';
import { isAffirmativeDecision } from '../core/utils/voice-row-match.util';
import {
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
};

const PAGE_LABEL: Record<CampusVoicePage, string> = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  locations: 'Locations',
  sessions: 'Sessions',
  students: 'Students',
  reports: 'Reports',
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
  private readonly auth = inject(AuthService);
  private readonly pages = inject(VoicePageRegistry);

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<VoiceToolResult> {
    switch (name) {
      case 'navigate_campus':
        return this.navigate(String(args['page'] ?? ''));
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

  async navigate(pageRaw: string): Promise<VoiceToolResult> {
    const page = pageRaw.trim().toLowerCase() as CampusVoicePage;
    if (!PAGE_PATH[page]) {
      return fail('I can open Dashboard, Attendance, Locations, or Sessions.');
    }
    if (page === 'students' && this.auth.role() !== 'admin') {
      return fail('Students is admin only. I can open Attendance or Sessions instead.');
    }
    if (page === 'reports' && this.auth.role() !== 'admin') {
      return fail(
        'Reports is admin only. Use Export on Attendance or Locations instead.',
      );
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
