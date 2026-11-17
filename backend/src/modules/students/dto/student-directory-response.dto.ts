import type { StudentResponseDto } from './student-response.dto';

export interface StudentDirectoryResponseDto {
  students: StudentResponseDto[];
  courses: string[];
}
