import { IsDateString, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for POST /sessions/:id/edit.
 * Separate from create — does not open a new session or issue a QR token.
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

  /**
   * Absolute due instant (ISO-8601) from the teacher browser.
   * Any valid date and time is accepted — including instants already passed.
   */
  @IsDateString()
  @IsNotEmpty()
  dueAt!: string;
}
