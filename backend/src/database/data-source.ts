import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';

/**
 * CLI / migration DataSource.
 * App runtime uses TypeOrmModule.forRootAsync in AppModule instead.
 */
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'smartcampus',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'smart_campus',
  entities: [...ALL_ENTITIES],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});

export const databaseDataSource = {
  migrationsPath: 'src/database/migrations',
  seedersPath: 'src/database/seeders',
};
