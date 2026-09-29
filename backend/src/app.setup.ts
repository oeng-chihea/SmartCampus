import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAllowedCorsOrigin } from './common/utils/cors-origin.util';

/**
 * Private LAN / loopback origins used by phones and laptops on campus Wi‑Fi.
 * Dev only — production relies on explicit CORS_ORIGINS.
 */
function isDevLanOrigin(origin: string): boolean {
  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    // Angular default port; allow empty port for rare reverse-proxy cases.
    if (port && port !== '4200' && port !== '') {
      return false;
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }
    // 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }
    const m = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
    if (m) {
      const second = Number(m[1]);
      return second >= 16 && second <= 31;
    }
    return false;
  } catch {
    return false;
  }
}

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  const isDev =
    (config.get<string>('app.nodeEnv') ?? 'development') !== 'production';
  new Logger('CORS').log(
    `Allowed origins: ${corsOrigins.join(', ') || '(none)'}`,
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser clients (curl, same-origin proxy) may omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedCorsOrigin(origin, corsOrigins)) {
        callback(null, true);
        return;
      }
      if (isDev && isDevLanOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
}
