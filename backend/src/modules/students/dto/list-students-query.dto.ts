import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STUDENT_STATUSES = ['Active', 'Inactive'] as const;

export class ListStudentsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  course?: string;

  @IsOptional()
  @IsIn(STUDENT_STATUSES)
  status?: (typeof STUDENT_STATUSES)[number];
}
