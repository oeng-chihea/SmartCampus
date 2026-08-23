import { registerAs } from '@nestjs/config';

export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const DEFAULT_GEMINI_API_VERSION = 'v1alpha';

export default registerAs('gemini', () => ({
  apiKey: String(process.env.GEMINI_API_KEY ?? '').trim(),
  liveModel:
    String(process.env.GEMINI_LIVE_MODEL ?? '').trim() ||
    DEFAULT_GEMINI_LIVE_MODEL,
  apiVersion:
    String(process.env.GEMINI_API_VERSION ?? '').trim() ||
    DEFAULT_GEMINI_API_VERSION,
}));
