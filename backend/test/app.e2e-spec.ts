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

  it('returns a scan origin for teacher QR deep links', () =>
    request(app.getHttpServer())
      .get('/api/runtime/scan-origin')
      .set('Origin', 'http://localhost:4200')
      .expect(200)
      .expect(({ body }: { body: { origin: string; connected: boolean } }) => {
        expect(body.origin).toMatch(/^https?:\/\//);
        expect(typeof body.connected).toBe('boolean');
      }));

  it('does not expose the old unprefixed root endpoint', () =>
    request(app.getHttpServer()).get('/').expect(404));

  it('logs in a demo user through POST /api/auth/login', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'teacher@smartcampus.edu',
        password: 'teacher123',
      })
      .expect(201)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body).toMatchObject({
          user: {
            id: 'u-teacher-1',
            name: 'Teacher Kim',
            email: 'teacher@smartcampus.edu',
            role: 'teacher',
          },
        });
        expect(body.accessToken).toEqual(expect.any(String));
      }));

  it('rejects invalid login credentials', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'teacher@smartcampus.edu',
        password: 'wrong-password',
      })
      .expect(401));

  it.each([
    [
      { password: 'teacher123' },
      ['email should not be empty', 'email must be an email'],
    ],
    [
      { email: 'not-an-email', password: 'teacher123' },
      ['email must be an email'],
    ],
    [{ email: 'teacher@smartcampus.edu' }, ['password should not be empty']],
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
