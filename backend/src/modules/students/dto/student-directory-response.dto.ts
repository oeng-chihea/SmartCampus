import type { StudentResponseDto } from './student-response.dto';

export interface StudentDirectorySummaryDto {
  totalStudents: number;
  activeScanners: number;
  loginEnabledCount: number;
  needsReview: number;
}

export interface StudentDirectoryResponseDto {
  students: StudentResponseDto[];
  courses: string[];
  summary: StudentDirectorySummaryDto;
}
