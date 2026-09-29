import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STUDENT_STATUSES = ['Active', 'Review', 'Inactive'] as const;

export class ListStudentsQueryDto {
  /** Prefix search across student name, ID, and email. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  course?: string;

  @IsOptional()
  @IsIn([...STUDENT_STATUSES, 'all'])
  status?: (typeof STUDENT_STATUSES)[number] | 'all';
}
