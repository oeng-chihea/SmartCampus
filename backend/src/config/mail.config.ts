import { registerAs } from '@nestjs/config';

const DEFAULT_RESET_BASE_URL = 'https://localhost:4200';

function clean(value: string | undefined): string {
  return String(value ?? '').trim();
}

export default registerAs('mail', () => ({
  host: clean(process.env.SMTP_HOST),
  port: Number(process.env.SMTP_PORT ?? 465),
  user: clean(process.env.SMTP_USER),
  pass: clean(process.env.SMTP_PASS),
  from: clean(process.env.MAIL_FROM) || 'Smart Campus <no-reply@localhost>',
  resetBaseUrl: (
    clean(process.env.RESET_LINK_BASE_URL) ||
    clean(process.env.PUBLIC_APP_URL) ||
    DEFAULT_RESET_BASE_URL
  ).replace(/\/+$/, ''),
}));
