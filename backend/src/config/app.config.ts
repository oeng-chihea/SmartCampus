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
   * Comma-separated list of allowed frontend origins.
   * Keep the LAN IP in sync with frontend environment.development.ts.
   * Example: CORS_ORIGINS=http://localhost:4200,http://192.168.0.66:4200
   */
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
}));
