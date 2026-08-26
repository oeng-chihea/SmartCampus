import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { campusGreetingPeriod } from '../../common/utils/date.util';
import { StudentsService } from '../students/students.service';
import { CampusVoiceSnapshotService } from './campus-voice.snapshot.service';
import { buildCampusVoiceInstruction } from './campus-voice.instruction';
import { buildCampusVoiceTools } from './campus-voice.tools';
import { CreateLiveTokenDto } from './dto/create-live-token.dto';
import { CampusRecordsQueryDto } from './dto/campus-records-query.dto';
import { CampusRecordsResponseDto } from './dto/campus-records-response.dto';
import {
  GeminiLiveConnectConfig,
  LiveTokenResponseDto,
} from './dto/live-token-response.dto';
import {
  GEMINI_LIVE_WEBSOCKET_URL,
  mintGeminiLiveToken,
} from './gemini-live.client';

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly snapshot: CampusVoiceSnapshotService,
    private readonly students: StudentsService,
  ) {}

  async createLiveToken(
    user: AuthenticatedUser,
    dto: CreateLiveTokenDto,
  ): Promise<LiveTokenResponseDto> {
    const apiKey = String(this.config.get<string>('gemini.apiKey') ?? '').trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Add GEMINI_API_KEY to backend/.env before using English voice.',
      );
    }

    const model =
      String(this.config.get<string>('gemini.liveModel') ?? '').trim() ||
      'gemini-3.1-flash-live-preview';
    const apiVersion =
      String(this.config.get<string>('gemini.apiVersion') ?? '').trim() ||
      'v1alpha';
    const resumeHandle = String(dto.resumeHandle ?? '').trim();
    const currentPage = String(dto.page ?? '').trim();
    const liveConnectConfig = await this.buildLiveConnectConfig(
      user,
      resumeHandle,
      currentPage,
    );

    try {
      const token = await mintGeminiLiveToken({
        apiKey,
        apiVersion,
        model,
        liveConnectConfig,
      });
      const tokenName = String(token.name ?? '').trim();
      if (!tokenName) {
        throw new ServiceUnavailableException(
          'Gemini Live did not return a voice token. Try again.',
        );
      }

      return {
        token: tokenName,
        model,
        websocketUrl: GEMINI_LIVE_WEBSOCKET_URL,
        config: liveConnectConfig,
        expireTime: token.expireTime ?? null,
        newSessionExpireTime: token.newSessionExpireTime ?? null,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Could not create a Gemini Live voice token.';
      throw new ServiceUnavailableException(message);
    }
  }

  readCampusRecords(
    user: AuthenticatedUser,
    query: CampusRecordsQueryDto = {},
  ): Promise<CampusRecordsResponseDto> {
    return this.snapshot.readCampusRecords(user, query);
  }

  async buildLiveConnectConfig(
    user: AuthenticatedUser,
    resumeHandle = '',
    currentPage = '',
  ): Promise<GeminiLiveConnectConfig> {
    const studentName =
      user.role === USER_ROLES.student
        ? ((await this.students.findByUserId(user.userId))?.name ?? '')
        : '';

    return {
      responseModalities: ['AUDIO'],
      systemInstruction: buildCampusVoiceInstruction(user.role, currentPage, {
        greetingPeriod: campusGreetingPeriod(),
        studentName,
      }),
      tools: [{ functionDeclarations: buildCampusVoiceTools(user.role) }],
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
          endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
          prefixPaddingMs: 80,
          silenceDurationMs: 400,
        },
      },
    };
  }
}
