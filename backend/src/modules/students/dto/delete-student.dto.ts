import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  studentId!: string;
}
