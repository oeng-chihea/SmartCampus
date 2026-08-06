import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DEFAULT_LATE_AFTER_MINUTES } from '../../../common/constants/session.constant';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(180)
  lateAfterMinutes?: number = DEFAULT_LATE_AFTER_MINUTES;
}
