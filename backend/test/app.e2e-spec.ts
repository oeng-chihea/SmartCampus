import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AppModule } from '../src/app.module';

describe('Smart Campus API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('serves the root endpoint under the /api prefix', () =>
    request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!'));

  it('does not expose the old unprefixed root endpoint', () =>
    request(app.getHttpServer()).get('/').expect(404));

  it('logs in a demo user through POST /api/auth/login', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@smartcampus.edu',
        password: 'admin123',
      })
      .expect(201)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({
          user: {
            id: 'u-admin-1',
            name: 'System Admin',
            email: 'admin@smartcampus.edu',
            role: 'admin',
          },
        });
        expect(body.accessToken).toEqual(expect.any(String));
      }));

  it('rejects invalid login credentials', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'admin@smartcampus.edu',
        password: 'wrong-password',
      })
      .expect(401));

  it.each([
    [
      { password: 'admin123' },
      ['email should not be empty', 'email must be an email'],
    ],
    [
      { email: 'not-an-email', password: 'admin123' },
      ['email must be an email'],
    ],
    [{ email: 'admin@smartcampus.edu' }, ['password should not be empty']],
  ])('rejects an invalid login payload %#', (payload, messages) =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send(payload)
      .expect(400)
      .expect(({ body }: { body: { message: string[] } }) => {
        expect(body.message).toEqual(expect.arrayContaining(messages));
      }),
  );

  afterEach(async () => {
    await app.close();
  });
});
