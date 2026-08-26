import { registerAs } from '@nestjs/config';
import { resolveCorsOrigins } from '../common/utils/cors-origin.util';

export default registerAs('app', () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /**
   * Frontend origins allowed by CORS. Includes PUBLIC_APP_URL when set.
   * Example: CORS_ORIGINS=http://localhost:4200,https://your-app.onrender.com
   */
  corsOrigins: resolveCorsOrigins(
    process.env.CORS_ORIGINS,
    process.env.PUBLIC_APP_URL,
  ),
  /**
   * Public frontend URL encoded into teacher QR when the API is on another host
   * (for example a Render web service). Example: https://smart-campus.onrender.com
   */
  publicAppUrl: String(process.env.PUBLIC_APP_URL ?? '').trim(),
}));