import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { VoiceLiveService } from '../../../services/voice-live.service';

@Component({
  selector: 'app-voice-assistant',
  templateUrl: './voice-assistant.component.html',
  styleUrl: './voice-assistant.component.scss',
  host: {
    '[class.is-active]': 'voice.active()',
    '[class.is-dragging]': 'dragging()',
  },
})
export class VoiceAssistantComponent implements OnInit, OnDestroy {
  readonly voice = inject(VoiceLiveService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** Students auto-start Campus Voice on the scan page. Teachers tap to start. */
  readonly autoStart = input(false);

  /** Absolute viewport position of the floating call card; null = CSS default. */
  readonly position = signal<{ x: number; y: number } | null>(null);
  readonly dragging = signal(false);

  private dragPointerId: number | null = null;
  private dragOrigin = { pointerX: 0, pointerY: 0, x: 0, y: 0 };
  private dragMoved = false;
  private readonly dragThresholdPx = 3;
  private boundMove: ((event: PointerEvent) => void) | null = null;
  private boundUp: ((event: PointerEvent) => void) | null = null;

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
        return 'Campus Voice';
    }
  }

  buttonLabel(): string {
    return this.voice.active() ? 'Stop voice' : 'Start English voice';
  }

  onDragPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }

    const current = this.ensurePosition(event.currentTarget as HTMLElement | null);
    this.dragging.set(true);
    this.dragMoved = false;
    this.dragPointerId = event.pointerId;
    this.dragOrigin = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: current.x,
      y: current.y,
    };

    this.attachDocumentDragListeners();
    event.preventDefault();
    event.stopPropagation();
  }

  async onClose(): Promise<void> {
    if (this.voice.active()) {
      await this.voice.stop();
    }
    this.position.set(null);
  }

  ngOnInit(): void {
    if (this.autoStart() && !this.voice.active()) {
      void this.voice.start();
    }
  }

  ngOnDestroy(): void {
    this.detachDocumentDragListeners();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const current = this.position();
    if (!current) {
      return;
    }
    this.position.set(this.clamp(current.x, current.y));
  }

  private onDocumentPointerMove(event: PointerEvent): void {
    if (!this.dragging() || event.pointerId !== this.dragPointerId) {
      return;
    }

    const dx = event.clientX - this.dragOrigin.pointerX;
    const dy = event.clientY - this.dragOrigin.pointerY;
    if (!this.dragMoved && Math.hypot(dx, dy) < this.dragThresholdPx) {
      return;
    }

    this.dragMoved = true;
    this.position.set(this.clamp(this.dragOrigin.x + dx, this.dragOrigin.y + dy));
  }

  private onDocumentPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) {
      return;
    }

    this.dragging.set(false);
    this.dragPointerId = null;
    this.detachDocumentDragListeners();
  }

  private attachDocumentDragListeners(): void {
    this.detachDocumentDragListeners();
    this.boundMove = (event) => this.onDocumentPointerMove(event);
    this.boundUp = (event) => this.onDocumentPointerUp(event);
    document.addEventListener('pointermove', this.boundMove);
    document.addEventListener('pointerup', this.boundUp);
    document.addEventListener('pointercancel', this.boundUp);
  }

  private detachDocumentDragListeners(): void {
    if (this.boundMove) {
      document.removeEventListener('pointermove', this.boundMove);
      this.boundMove = null;
    }
    if (this.boundUp) {
      document.removeEventListener('pointerup', this.boundUp);
      document.removeEventListener('pointercancel', this.boundUp);
      this.boundUp = null;
    }
  }

  private ensurePosition(card: HTMLElement | null): { x: number; y: number } {
    const existing = this.position();
    if (existing) {
      return existing;
    }

    const rect = (card ?? this.host.nativeElement).getBoundingClientRect();
    const next = this.clamp(rect.left, rect.top);
    this.position.set(next);
    return next;
  }

  private clamp(x: number, y: number): { x: number; y: number } {
    const card = this.host.nativeElement.querySelector(
      '.voice-assistant__call',
    ) as HTMLElement | null;
    const width = card?.offsetWidth || 180;
    const height = card?.offsetHeight || 240;
    const pad = 12;
    const maxX = Math.max(pad, window.innerWidth - width - pad);
    const maxY = Math.max(pad, window.innerHeight - height - pad);

    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY),
    };
  }
}
