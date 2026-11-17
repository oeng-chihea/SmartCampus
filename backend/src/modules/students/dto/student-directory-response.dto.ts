import type { StudentResponseDto } from './student-response.dto';

export interface StudentDirectorySummaryDto {
  totalStudents: number;
  activeScanners: number;
  loginEnabledCount: number;
}

export interface StudentDirectoryResponseDto {
  students: StudentResponseDto[];
  courses: string[];
  summary: StudentDirectorySummaryDto;
}
