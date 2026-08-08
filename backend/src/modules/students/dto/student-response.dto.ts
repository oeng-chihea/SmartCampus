export interface StudentResponseDto {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  attendanceRate: number;
  status: string;
  loginEnabled: boolean;
  /** True when a login account exists (users row linked via user_id). */
  hasAccount: boolean;
}
