import { UserRole } from '../../../common/constants/roles.constant';

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
}
