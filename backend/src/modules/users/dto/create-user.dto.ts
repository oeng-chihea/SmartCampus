import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { USER_ROLES } from '../../../common/constants/roles.constant';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(Object.values(USER_ROLES))
  role!: string;

  /** Required when role is student — links the account to a student profile. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  studentId?: string;
}
