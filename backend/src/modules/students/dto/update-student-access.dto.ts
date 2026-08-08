import { IsBoolean } from 'class-validator';

export class UpdateStudentAccessDto {
  @IsBoolean()
  loginEnabled!: boolean;
}
