import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Optional query for GET /sessions.
 * When `page` or `limit` is present, the API returns a paginated envelope
 * (session picker). Without them, the API still returns the full array
 * (Sessions page log).
 */
export class ListSessionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Case-insensitive match on title, location, or teacher name. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
