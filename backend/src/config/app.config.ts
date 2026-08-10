import { registerAs } from '@nestjs/config';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

function parseCorsOrigins(raw: string | undefined): string[] {
  const fromEnv = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_CORS_ORIGINS;
}

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /**
   * Comma-separated list of allowed frontend origins (exact match).
   * In development, app.setup also allows private LAN origins (192.168/10/172.16)
   * so Wi‑Fi IP changes do not break CORS when not using the Angular proxy.
   * Example: CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
   */
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
}));