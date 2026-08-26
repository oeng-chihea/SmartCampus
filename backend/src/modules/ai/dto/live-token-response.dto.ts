export interface GeminiLiveConnectConfig {
  responseModalities: string[];
  systemInstruction: string;
  tools: Array<{ functionDeclarations: unknown[] }>;
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
