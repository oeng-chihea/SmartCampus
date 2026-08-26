import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { APP_ROUTES } from '../../../../core/constants/app-routes';
import { VOICE_RECORD_DETAIL_HINT } from '../../../../core/utils/voice-record-summary.util';
import {
  VoiceActArgs,
  VoiceConfirmArgs,
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { AttendanceChartComponent } from '../../../../shared/components/attendance-chart/attendance-chart.component';
import { RecentScanListComponent } from '../../../../shared/components/recent-scan-list/recent-scan-list.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { DashboardFlow } from './dashboard.flow';
import { DashboardState } from './dashboard.state';

@Component({
  selector: 'app-dashboard',
  imports: [AttendanceChartComponent, RecentScanListComponent, StatCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  providers: [DashboardState, DashboardFlow],
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly state = inject(DashboardState);
  private readonly flow = inject(DashboardFlow);
  private readonly voicePages = inject(VoicePageRegistry);

  readonly attendancePath = `/${APP_ROUTES.attendance}`;

  ngOnInit(): void {
    this.voicePages.register({
      page: 'dashboard',
      startContext: () => this.voiceStatusMessage(),
      control: (args) => this.voiceControl(args),
      select: () => this.wrongPage(),
      act: () => this.wrongPage(),
      confirm: () => this.wrongPage(),
    });
    void this.flow.load();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('dashboard');
  }

  private voiceStatusMessage(): string {
    const cards = this.state
      .summaryCards()
      .map((card) => `${card.label} ${card.value}`)
      .join(', ');
    return cards
      ? `The staff is on Dashboard. ${cards}. ${VOICE_RECORD_DETAIL_HINT}`
      : `The staff is on Dashboard. ${VOICE_RECORD_DETAIL_HINT}`;
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.flow.load();
      }
      return { ok: true, message: this.voiceStatusMessage() };
    }
    return this.wrongPage();
  }

  private wrongPage(
    _args?: VoiceSelectArgs | VoiceActArgs | VoiceConfirmArgs,
  ): Promise<VoiceToolResult> {
    return Promise.resolve({
      ok: false,
      message: 'On Dashboard I can refresh or go to Attendance or Sessions.',
    });
  }
}
