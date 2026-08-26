import { registerAs } from '@nestjs/config';

function isLocalHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

export default registerAs('database', () => {
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const sslFlag = String(process.env.DB_SSL ?? '').toLowerCase();
  const useSsl =
    sslFlag === 'true' ||
    (sslFlag !== 'false' && !isLocalHost(host));

  return {
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'smartcampus',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'smart_campus',
    /** When true, TypeORM creates/updates tables from entities (local dev). */
    synchronize: (process.env.DB_SYNC ?? 'true').toLowerCase() === 'true',
    /** TiDB Cloud and most hosted MySQL require TLS. Local Workbench does not. */
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  };
});
