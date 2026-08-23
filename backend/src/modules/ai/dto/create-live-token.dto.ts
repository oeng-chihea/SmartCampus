import { IsOptional, IsString } from 'class-validator';

export class CreateLiveTokenDto {
  @IsOptional()
  @IsString()
  resumeHandle?: string;
}
