import { IsIn, IsOptional, IsString } from 'class-validator';

const CAMPUS_VOICE_PAGES = [
  'dashboard',
  'attendance',
  'locations',
  'sessions',
  'students',
  'scan',
] as const;

export class CreateLiveTokenDto {
  @IsOptional()
  @IsString()
  resumeHandle?: string;

  @IsOptional()
  @IsIn(CAMPUS_VOICE_PAGES)
  page?: (typeof CAMPUS_VOICE_PAGES)[number];
}
