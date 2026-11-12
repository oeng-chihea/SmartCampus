import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

interface BrevoRequest {
  sender: { name?: string; email: string };
  to: { name?: string; email: string }[];
  bcc?: { email: string }[];
  subject: string;
  htmlContent: string;
}

const brevoConfig = {
  'mail.brevoApiKey': 'test-key',
  'mail.from': 'Smart Campus <alerts@campus.edu>',
  'mail.appBaseUrl': 'https://campus.example',
};

const session = {
  title: 'AI <Lab>',
  teacherName: 'Teacher Kim',
  locationName: 'KIT-Building A',
  dueAt: new Date('2026-11-12T10:00:00Z'),
};

function createService(values: Record<string, string>): MailService {
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
  return new MailService(config);
}

function studentEmails(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `student${i}@campus.edu`);
}

describe('MailService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(new Response('{}', { status: 201 })),
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function sentRequests(): BrevoRequest[] {
    return fetchMock.mock.calls.map(
      ([, init]) => JSON.parse(init?.body as string) as BrevoRequest,
    );
  }

  it('sends session alerts through Brevo in BCC batches of 50', async () => {
    await createService(brevoConfig).sendSessionOpened(
      studentEmails(120),
      session,
    );

    const requests = sentRequests();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.brevo.com/v3/smtp/email',
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      'api-key': 'test-key',
    });
    expect(requests.map((request) => request.bcc?.length)).toEqual([
      50, 50, 20,
    ]);
    expect(requests[0].sender).toEqual({
      name: 'Smart Campus',
      email: 'alerts@campus.edu',
    });
    expect(requests[0].subject).toBe('Attendance open: AI <Lab>');
    expect(requests[0].htmlContent).toContain('Session: AI &lt;Lab&gt;');
    expect(requests[0].htmlContent).toContain(
      'https://campus.example/student/scan',
    );
  });

  it('logs a failed batch and keeps sending the rest', async () => {
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(
      new Response('sender not verified', { status: 400 }),
    );

    await createService(brevoConfig).sendSessionOpened(
      studentEmails(60),
      session,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith(
      'Session alert batch failed',
      expect.any(Error),
    );
  });

  it('sends the password reset email through Brevo', async () => {
    await createService(brevoConfig).sendPasswordReset(
      'dara@campus.edu',
      'Dara',
      'https://campus.example/reset',
    );

    const [request] = sentRequests();
    expect(request.to).toEqual([{ email: 'dara@campus.edu' }]);
    expect(request.bcc).toBeUndefined();
    expect(request.htmlContent).toContain('Hi Dara,');
  });

  it('sends nothing when no email provider is configured', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const service = createService({});

    await service.sendSessionOpened(['dara@campus.edu'], session);

    expect(service.isConfigured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
