import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import * as geminiLiveClient from './gemini-live.client';

jest.mock('./gemini-live.client', () => ({
  GEMINI_LIVE_WEBSOCKET_URL:
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
  mintGeminiLiveToken: jest.fn(),
}));

const admin: AuthenticatedUser = {
  userId: 'u-admin-1',
  role: USER_ROLES.admin,
};

function configWith(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

describe('AiService', () => {
  const mint = geminiLiveClient.mintGeminiLiveToken as jest.MockedFunction<
    typeof geminiLiveClient.mintGeminiLiveToken
  >;

  beforeEach(() => {
    mint.mockReset();
  });

  it('returns 503 when GEMINI_API_KEY is missing', async () => {
    const service = new AiService(configWith({ 'gemini.apiKey': '' }));
    await expect(service.createLiveToken(admin, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(mint).not.toHaveBeenCalled();
  });

  it('mints a constrained live token for admin', async () => {
    mint.mockResolvedValue({
      name: 'auth_tokens/test-token',
      expireTime: '2026-08-21T12:00:00Z',
      newSessionExpireTime: '2026-08-21T11:31:00Z',
    });
    const service = new AiService(
      configWith({
        'gemini.apiKey': 'test-key',
        'gemini.liveModel': 'gemini-3.1-flash-live-preview',
        'gemini.apiVersion': 'v1alpha',
      }),
    );

    const result = await service.createLiveToken(admin, {});

    expect(result.token).toBe('auth_tokens/test-token');
    expect(result.model).toBe('gemini-3.1-flash-live-preview');
    expect(result.config.responseModalities).toEqual(['AUDIO']);
    expect(result.config.systemInstruction).toContain('Speak English only');
    expect(result.config.tools[0].functionDeclarations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'navigate_campus' }),
        expect.objectContaining({ name: 'stop_voice_conversation' }),
      ]),
    );
    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        model: 'gemini-3.1-flash-live-preview',
      }),
    );
  });
});
