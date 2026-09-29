import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

/** Editable profile fields, including the student's directory identifier. */
export class UpdateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  course!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  year!: string;
}
