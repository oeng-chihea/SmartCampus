export type StudentStatus = 'Active' | 'Review' | 'Inactive';

export interface StudentResponseDto {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  attendanceRate: number;
  status: StudentStatus;
  loginEnabled: boolean;
}
