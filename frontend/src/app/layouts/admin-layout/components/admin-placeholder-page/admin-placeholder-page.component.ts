import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
import { VoiceToolResult } from '../../../../models/voice-live.model';

@Component({
  selector: 'app-admin-placeholder-page',
  templateUrl: './admin-placeholder-page.component.html',
  styleUrl: './admin-placeholder-page.component.scss',
})
export class AdminPlaceholderPageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly voicePages = inject(VoicePageRegistry);

  readonly title = this.route.snapshot.data['title'] as string;

  constructor() {
    this.voicePages.register({
      page: 'reports',
      startContext: () => 'The staff is on Reports. This page is not ready yet.',
      control: () => this.notReady(),
      select: () => this.notReady(),
      act: () => this.notReady(),
      confirm: () => this.notReady(),
    });
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('reports');
  }

  private notReady(): Promise<VoiceToolResult> {
    return Promise.resolve({
      ok: false,
      message: 'Reports is not ready yet.',
    });
  }
}
