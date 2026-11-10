import { IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'token is invalid' })
  token!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
