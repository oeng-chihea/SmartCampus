import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for POST /sessions/:id/edit.
 * Separate from create — title and campus location only.
 * dueAt is set at create and cannot be changed (keeps student attendance on the original day).
 */
export class EditSessionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  locationId!: string;
}
