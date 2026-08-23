import { Injectable, signal } from '@angular/core';
import { CampusVoicePage, VoicePageHandler } from '../models/voice-live.model';

@Injectable({ providedIn: 'root' })
export class VoicePageRegistry {
  private readonly handlerSignal = signal<VoicePageHandler | null>(null);
  readonly handler = this.handlerSignal.asReadonly();

  register(handler: VoicePageHandler): void {
    this.handlerSignal.set(handler);
  }

  unregister(page: CampusVoicePage): void {
    if (this.handlerSignal()?.page === page) {
      this.handlerSignal.set(null);
    }
  }

  current(): VoicePageHandler | null {
    return this.handlerSignal();
  }

  startContext(): string {
    const handler = this.handlerSignal();
    if (!handler) {
      return 'session_start_context: The staff is on an admin page.';
    }
    return `session_start_context: ${handler.startContext()}`;
  }
}
