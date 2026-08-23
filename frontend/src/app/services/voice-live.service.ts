import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import {
  float32ToPcm16Base64,
  pcm16Base64ToAudioBuffer,
  voiceCaptureWorkletSource,
} from '../core/utils/voice-audio.util';
import { VoiceLiveStatus, VoiceLiveToken } from '../models/voice-live.model';
import { AuthService } from './auth.service';
import { VoicePageRegistry } from './voice-page-registry.service';
import { VoiceToolExecutor } from './voice-tool-executor.service';

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DEFAULT_WS =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';

@Injectable({ providedIn: 'root' })
export class VoiceLiveService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly tools = inject(VoiceToolExecutor);
  private readonly pages = inject(VoicePageRegistry);

  readonly status = signal<VoiceLiveStatus>('idle');
  readonly userTranscript = signal('');
  readonly assistantTranscript = signal('');
  readonly error = signal<string | null>(null);
  readonly active = computed(
    () => this.status() === 'connecting' || this.status() === 'listening' || this.status() === 'speaking',
  );

  private session: WebSocket | null = null;
  private sessionReady = false;
  private resumeHandle = '';
  private inputContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private workletUrl: string | null = null;
  private playbackTime = 0;
  private playbackSources = new Set<AudioBufferSourceNode>();
  private starting = false;

  async toggle(): Promise<void> {
    if (this.active()) {
      await this.stop();
      return;
    }
    await this.start();
  }

  async start(): Promise<void> {
    if (this.starting || this.active()) {
      return;
    }
    this.starting = true;
    this.error.set(null);
    this.userTranscript.set('');
    this.assistantTranscript.set('');
    this.status.set('connecting');

    try {
      await this.openSession();
      await this.startMic();
      this.status.set('listening');
    } catch (error) {
      this.status.set('error');
      this.error.set(this.mapError(error));
      await this.cleanup();
    } finally {
      this.starting = false;
    }
  }

  async stop(): Promise<void> {
    await this.cleanup();
    this.status.set('idle');
  }

  private async openSession(): Promise<void> {
    const token = await this.fetchToken();
    const tokenValue = String(token.token || '').trim();
    if (!tokenValue) {
      throw new Error('Gemini Live token response did not include a token.');
    }

    const baseUrl = String(token.websocketUrl || DEFAULT_WS).trim();
    const separator = baseUrl.includes('?') ? '&' : '?';
    const socket = new WebSocket(
      `${baseUrl}${separator}access_token=${encodeURIComponent(tokenValue)}`,
    );
    socket.binaryType = 'arraybuffer';
    this.session = socket;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (reason: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      };

      socket.addEventListener('open', () => {
        try {
          socket.send(JSON.stringify(this.buildSetupMessage(token)));
        } catch (error) {
          fail(error);
        }
      });

      socket.addEventListener('message', (event) => {
        void this.onSocketMessage(event, () => {
          if (!settled) {
            settled = true;
            this.sessionReady = true;
            resolve();
          }
        });
      });

      socket.addEventListener('error', () => {
        fail(new Error('Could not connect to Gemini Live.'));
      });

      socket.addEventListener('close', (event) => {
        if (!settled) {
          fail(new Error(event.reason || 'Gemini Live closed before setup completed.'));
          return;
        }
        if (this.session === socket && this.active()) {
          this.status.set('error');
          this.error.set('Voice connection closed. Tap the mic to start again.');
          void this.cleanup();
        }
      });
    });

    this.sendStartContext();
  }

  private async fetchToken(): Promise<VoiceLiveToken> {
    const body = this.resumeHandle ? { resumeHandle: this.resumeHandle } : {};
    return firstValueFrom(
      this.http.post<VoiceLiveToken>(
        `${environment.apiBaseUrl}${API_ENDPOINTS.aiLiveToken}`,
        body,
        { headers: this.authHeaders() },
      ),
    );
  }

  private buildSetupMessage(token: VoiceLiveToken): unknown {
    const config = token.config;
    const model = token.model.startsWith('models/')
      ? token.model
      : `models/${token.model}`;
    return {
      setup: {
        model,
        generationConfig: {
          responseModalities:
            config.responseModalities?.length > 0
              ? config.responseModalities
              : ['AUDIO'],
        },
        systemInstruction: config.systemInstruction
          ? { parts: [{ text: config.systemInstruction }] }
          : undefined,
        tools: config.tools,
        inputAudioTranscription: config.inputAudioTranscription || {},
        outputAudioTranscription: config.outputAudioTranscription || {},
        sessionResumption: config.sessionResumption,
        realtimeInputConfig: config.realtimeInputConfig,
      },
    };
  }

  private sendStartContext(): void {
    if (!this.session || this.session.readyState !== WebSocket.OPEN) {
      return;
    }
    this.session.send(
      JSON.stringify({
        realtimeInput: {
          text: this.pages.startContext(),
        },
      }),
    );
  }

  private async onSocketMessage(
    event: MessageEvent,
    onReady: () => void,
  ): Promise<void> {
    const message = await this.parseEvent(event);
    if (!message) {
      return;
    }

    const resumption = message['sessionResumptionUpdate'] as
      | { handle?: string }
      | undefined;
    if (resumption?.handle) {
      this.resumeHandle = resumption.handle;
    }

    if (message['setupComplete']) {
      onReady();
    }

    const toolCall = message['toolCall'] as
      | { functionCalls?: Array<{ id?: string; name?: string; args?: unknown }> }
      | undefined;
    if (toolCall?.functionCalls?.length) {
      await this.handleToolCalls(toolCall.functionCalls);
    }

    const content = message['serverContent'] as
      | {
          interrupted?: boolean;
          turnComplete?: boolean;
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
        }
      | undefined;
    if (!content) {
      return;
    }

    if (content.inputTranscription?.text) {
      this.userTranscript.update(
        (current) => `${current}${content.inputTranscription?.text ?? ''}`.trim(),
      );
    }
    if (content.outputTranscription?.text) {
      this.assistantTranscript.update(
        (current) => `${current}${content.outputTranscription?.text ?? ''}`.trim(),
      );
    }
    if (content.interrupted) {
      this.stopPlayback();
      if (this.active()) {
        this.status.set('listening');
      }
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (!data) {
        continue;
      }
      this.status.set('speaking');
      await this.queuePlayback(data);
    }

    if (content.turnComplete && this.active()) {
      this.status.set('listening');
      this.userTranscript.set('');
    }
  }

  private async handleToolCalls(
    calls: Array<{ id?: string; name?: string; args?: unknown }>,
  ): Promise<void> {
    if (!this.session || this.session.readyState !== WebSocket.OPEN) {
      return;
    }

    const responses = [];
    let stopRequested = false;
    for (const call of calls) {
      const name = String(call.name || '').trim();
      const args =
        call.args && typeof call.args === 'object'
          ? (call.args as Record<string, unknown>)
          : {};
      const result = await this.tools.execute(name, args);
      responses.push({
        id: call.id,
        name,
        response: { output: result },
      });
      if (result.stop_requested) {
        stopRequested = true;
      }
    }

    this.session.send(
      JSON.stringify({
        toolResponse: { functionResponses: responses },
      }),
    );

    if (stopRequested) {
      await this.stop();
    }
  }

  private async parseEvent(event: MessageEvent): Promise<Record<string, unknown> | null> {
    let jsonText = '';
    if (event.data instanceof Blob) {
      jsonText = await event.data.text();
    } else if (event.data instanceof ArrayBuffer) {
      jsonText = new TextDecoder().decode(event.data);
    } else {
      jsonText = String(event.data || '');
    }
    jsonText = jsonText.trim();
    if (!jsonText) {
      return null;
    }
    try {
      return JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async startMic(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('This browser cannot capture microphone audio.');
    }
    this.inputContext = new AudioContextCtor();
    if (this.inputContext.state === 'suspended') {
      await this.inputContext.resume();
    }
    const source = this.inputContext.createMediaStreamSource(this.mediaStream);
    const inputRate = this.inputContext.sampleRate;

    const send = (samples: Float32Array) => {
      if (!this.session || this.session.readyState !== WebSocket.OPEN || !this.sessionReady) {
        return;
      }
      const audio = float32ToPcm16Base64(samples, inputRate, INPUT_RATE);
      if (!audio) {
        return;
      }
      this.session.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: audio,
              mimeType: `audio/pcm;rate=${INPUT_RATE}`,
            },
          },
        }),
      );
    };

    try {
      if (!this.workletUrl) {
        this.workletUrl = URL.createObjectURL(
          new Blob([voiceCaptureWorkletSource()], { type: 'application/javascript' }),
        );
      }
      await this.inputContext.audioWorklet.addModule(this.workletUrl);
      const node = new AudioWorkletNode(this.inputContext, 'voice-capture-processor');
      node.port.onmessage = (event) => {
        if (event.data instanceof Float32Array) {
          send(event.data);
        }
      };
      source.connect(node);
      this.workletNode = node;
    } catch {
      const processor = this.inputContext.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) => {
        send(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      const mute = this.inputContext.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(this.inputContext.destination);
      this.workletNode = processor;
    }
  }

  private async queuePlayback(base64: string): Promise<void> {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }
    if (!this.playbackContext) {
      this.playbackContext = new AudioContextCtor({ sampleRate: OUTPUT_RATE });
    }
    if (this.playbackContext.state === 'suspended') {
      await this.playbackContext.resume();
    }
    const buffer = pcm16Base64ToAudioBuffer(this.playbackContext, base64, OUTPUT_RATE);
    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);
    const startAt = Math.max(this.playbackTime, this.playbackContext.currentTime);
    source.start(startAt);
    this.playbackTime = startAt + buffer.duration;
    this.playbackSources.add(source);
    source.onended = () => {
      this.playbackSources.delete(source);
    };
  }

  private stopPlayback(): void {
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playbackSources.clear();
    this.playbackTime = 0;
  }

  private async cleanup(): Promise<void> {
    this.sessionReady = false;
    this.stopPlayback();
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        /* ignore */
      }
      this.workletNode = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.inputContext) {
      await this.inputContext.close().catch(() => undefined);
      this.inputContext = null;
    }
    if (this.session) {
      try {
        this.session.close();
      } catch {
        /* ignore */
      }
      this.session = null;
    }
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getAccessToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  private mapError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the API. Start the Nest backend and try again.';
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      const body = error.error as { message?: string | string[] } | null;
      if (typeof body?.message === 'string') {
        return body.message;
      }
      if (Array.isArray(body?.message)) {
        return body.message.join(', ');
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Could not start English voice.';
  }
}
