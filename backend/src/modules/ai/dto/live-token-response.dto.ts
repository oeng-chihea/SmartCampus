export interface GeminiLiveConnectConfig {
  responseModalities: string[];
  systemInstruction: string;
  tools: Array<{ functionDeclarations: unknown[] }>;
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  sessionResumption: { handle?: string };
  realtimeInputConfig: {
    automaticActivityDetection: {
      startOfSpeechSensitivity: string;
      endOfSpeechSensitivity: string;
      prefixPaddingMs: number;
      silenceDurationMs: number;
    };
  };
}

export interface LiveTokenResponseDto {
  token: string;
  model: string;
  websocketUrl: string;
  config: GeminiLiveConnectConfig;
  expireTime: string | null;
  newSessionExpireTime: string | null;
}
