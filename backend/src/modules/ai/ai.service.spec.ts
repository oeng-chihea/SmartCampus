import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { CampusVoiceSnapshotService } from './campus-voice.snapshot.service';
import { StudentsService } from '../students/students.service';
import * as geminiLiveClient from './gemini-live.client';

jest.mock('./gemini-live.client', () => ({
  GEMINI_LIVE_WEBSOCKET_URL:
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
  mintGeminiLiveToken: jest.fn(),
}));

const teacher: AuthenticatedUser = {
  userId: 'u-teacher-1',
  role: USER_ROLES.teacher,
};

const student: AuthenticatedUser = {
  userId: 'u-chihea',
  role: USER_ROLES.student,
};

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

function snapshotStub(
  overrides: Partial<CampusVoiceSnapshotService> = {},
): CampusVoiceSnapshotService {
  return {
    readCampusRecords: jest.fn().mockResolvedValue({
      generatedAt: '2026-08-25T00:00:00.000Z',
      filtered: false,
      spokenSummary:
        'These counts are for every record, with no filter applied. Attendance has 6 records: 3 present, 3 absent, 3 inside the location, and 3 outside the location.',
      dashboard: {
        cards: [],
        trendYear: 2026,
        monthlyTrend: [],
        recentScans: [],
      },
      attendance: {
        total: 6,
        present: 3,
        absent: 3,
        inside: 3,
        outside: 3,
        records: [],
      },
      locations: { total: 3, inside: 3, outside: 0, visits: [], zones: [] },
      sessions: { total: 1, open: 1, closed: 0, items: [] },
      students: { total: 1, loginEnabled: 1, loginDisabled: 0, items: [] },
    }),
    ...overrides,
  } as unknown as CampusVoiceSnapshotService;
}

function studentsStub(
  overrides: Partial<StudentsService> = {},
): StudentsService {
  return {
    findByUserId: jest.fn().mockResolvedValue({
      studentId: 'SC-1001',
      name: 'Chihea',
      email: 'chihea@smartcampus.edu',
      course: 'SE401',
      year: 'Year 1',
      loginEnabled: true,
      userId: 'u-chihea',
      attendanceRate: 90,
      status: 'Active',
    }),
    ...overrides,
  } as unknown as StudentsService;
}

describe('AiService', () => {
  const mint = geminiLiveClient.mintGeminiLiveToken as jest.MockedFunction<
    typeof geminiLiveClient.mintGeminiLiveToken
  >;

  beforeEach(() => {
    mint.mockReset();
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const service = new AiService(
      configWith({ 'gemini.apiKey': '' }),
      snapshotStub(),
      studentsStub(),
    );
    await expect(service.createLiveToken(teacher, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mint).not.toHaveBeenCalled();
  });

  it('mints a constrained live token without waiting on campus records', async () => {
    mint.mockResolvedValue({
      name: 'auth_tokens/test-token',
      expireTime: '2026-08-21T12:00:00Z',
      newSessionExpireTime: '2026-08-21T11:31:00Z',
    });
    const snapshot = snapshotStub();
    const students = studentsStub();
    const service = new AiService(
      configWith({
        'gemini.apiKey': 'test-key',
        'gemini.liveModel': 'gemini-3.1-flash-live-preview',
        'gemini.apiVersion': 'v1alpha',
      }),
      snapshot,
      students,
    );

    const result = await service.createLiveToken(teacher, { page: 'students' });

    expect(result.token).toBe('auth_tokens/test-token');
    expect(result.model).toBe('gemini-3.1-flash-live-preview');
    expect(result.config.responseModalities).toEqual(['AUDIO']);
    expect(result.config.systemInstruction).toContain('Speak English only');
    expect(result.config.systemInstruction).toContain(
      'currently on the Students page',
    );
    expect(result.config.systemInstruction).toContain(
      'Do not speak, greet, or call tools until the user talks',
    );
    expect(result.config.systemInstruction).not.toContain('6 records');
    expect(result.config.tools[0].functionDeclarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'navigate_campus' }),
        expect.objectContaining({ name: 'read_campus_records' }),
        expect.objectContaining({ name: 'stop_voice_conversation' }),
      ]),
    );
    expect(result.config.realtimeInputConfig.automaticActivityDetection).toEqual(
      expect.objectContaining({
        prefixPaddingMs: 80,
        silenceDurationMs: 400,
      }),
    );
    expect(snapshot.readCampusRecords).not.toHaveBeenCalled();
    expect(students.findByUserId).not.toHaveBeenCalled();
    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        model: 'gemini-3.1-flash-live-preview',
      }),
    );
  });

  it('mints a student scan token that greets immediately and skips staff tools', async () => {
    mint.mockResolvedValue({
      name: 'auth_tokens/student-token',
      expireTime: '2026-08-21T12:00:00Z',
      newSessionExpireTime: '2026-08-21T11:31:00Z',
    });
    const students = studentsStub();
    const service = new AiService(
      configWith({
        'gemini.apiKey': 'test-key',
        'gemini.liveModel': 'gemini-3.1-flash-live-preview',
        'gemini.apiVersion': 'v1alpha',
      }),
      snapshotStub(),
      students,
    );

    const result = await service.createLiveToken(student, { page: 'scan' });

    expect(result.config.systemInstruction).toContain(
      'do not wait for the student to speak first',
    );
    expect(result.config.systemInstruction).toContain('Chihea');
    expect(result.config.systemInstruction).toContain('Mark attendance');
    expect(result.config.systemInstruction).toContain(
      'Opening greeting is one short line only',
    );
    expect(result.config.systemInstruction).toContain('full campus loop');
    expect(result.config.systemInstruction).toContain(
      'call stop_voice_conversation immediately',
    );
    expect(result.config.systemInstruction).not.toContain(
      'two short warm sentences',
    );
    expect(result.config.systemInstruction).not.toContain(
      'Do not speak, greet, or call tools until the user talks',
    );
    expect(result.config.tools[0].functionDeclarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'read_campus_records' }),
        expect.objectContaining({ name: 'act_on_row' }),
        expect.objectContaining({ name: 'stop_voice_conversation' }),
      ]),
    );
    expect(result.config.tools[0].functionDeclarations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'navigate_campus' }),
      ]),
    );
    expect(students.findByUserId).toHaveBeenCalledWith('u-chihea');
  });
});
