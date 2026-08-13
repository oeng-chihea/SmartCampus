import { IsDateString, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSessionDto {
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
   * Any valid time today is accepted — including times already passed.
   * Students may mark present only while now &lt; dueAt.
   */
  @IsDateString()
  @IsNotEmpty()
  dueAt!: string;
}
