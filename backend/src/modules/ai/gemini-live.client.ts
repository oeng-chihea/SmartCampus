import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_API_VERSION } from '../../config/gemini.config';
import { GeminiLiveConnectConfig } from './dto/live-token-response.dto';

export const GEMINI_LIVE_WEBSOCKET_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${DEFAULT_GEMINI_API_VERSION}.GenerativeService.BidiGenerateContentConstrained`;

export function normalizeLiveModelName(model: string): string {
  const raw = String(model || '').trim();
  return raw.startsWith('models/') ? raw : `models/${raw}`;
}

export interface MintedGeminiLiveToken {
  name?: string;
  expireTime?: string;
  newSessionExpireTime?: string;
}

export async function mintGeminiLiveToken(options: {
  apiKey: string;
  apiVersion: string;
  model: string;
  liveConnectConfig: GeminiLiveConnectConfig;
}): Promise<MintedGeminiLiveToken> {
  const client = new GoogleGenAI({
    apiKey: options.apiKey,
    httpOptions: { apiVersion: options.apiVersion },
  });

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      liveConnectConstraints: {
        model: normalizeLiveModelName(options.model),
        config: options.liveConnectConfig as never,
      },
      httpOptions: { apiVersion: options.apiVersion },
    },
  });

  return {
    name: token?.name,
    expireTime: token?.expireTime,
    newSessionExpireTime: token?.newSessionExpireTime,
  };
}
