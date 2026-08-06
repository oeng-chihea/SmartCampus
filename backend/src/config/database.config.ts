import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'smartcampus',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'smart_campus',
  /** When true, TypeORM creates/updates tables from entities (local dev). */
  synchronize: (process.env.DB_SYNC ?? 'true').toLowerCase() === 'true',
}));
