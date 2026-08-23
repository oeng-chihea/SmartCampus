import { Component, inject } from '@angular/core';
import { VoiceLiveService } from '../../../services/voice-live.service';

@Component({
  selector: 'app-voice-assistant',
  templateUrl: './voice-assistant.component.html',
  styleUrl: './voice-assistant.component.scss',
})
export class VoiceAssistantComponent {
  readonly voice = inject(VoiceLiveService);

  statusLabel(): string {
    switch (this.voice.status()) {
      case 'connecting':
        return 'Connecting…';
      case 'listening':
        return 'Listening…';
      case 'speaking':
        return 'Speaking…';
      case 'error':
        return this.voice.error() || 'Voice error';
      default:
        return 'English voice';
    }
  }

  buttonLabel(): string {
    return this.voice.active() ? 'Stop voice' : 'Start English voice';
  }
}
