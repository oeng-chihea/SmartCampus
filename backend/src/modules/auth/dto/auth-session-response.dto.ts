import { UserResponseDto } from '../../users/dto/user-response.dto';

export interface AuthSessionResponseDto {
  accessToken: string;
  user: UserResponseDto;
}
