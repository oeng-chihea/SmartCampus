import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const CAMPUS_RECORD_SCOPES = [
  'all',
  'dashboard',
  'attendance',
  'locations',
  'sessions',
  'students',
] as const;

export type CampusRecordScope = (typeof CAMPUS_RECORD_SCOPES)[number];

/**
 * Optional filters for POST /ai/campus-records.
 * Omit every field (or send scope=all with no other fields) to read the
 * full unfiltered campus dataset for this teacher. Students receive only
 * their own open classes and recorded scans.
 */
export class CampusRecordsQueryDto {
  @IsOptional()
  @IsIn([...CAMPUS_RECORD_SCOPES])
  scope?: CampusRecordScope;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsIn(['all', 'Present', 'Absent'])
  attendance_status?: 'all' | 'Present' | 'Absent';

  @IsOptional()
  @IsIn(['all', 'inside', 'outside'])
  location_status?: 'all' | 'inside' | 'outside';

  @IsOptional()
  @IsIn(['all', 'today', 'yesterday', 'week'])
  date_filter?: 'all' | 'today' | 'yesterday' | 'week';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  building?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  session_query?: string;
}
