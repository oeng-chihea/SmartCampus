/** Wall-clock used for dashboard grouping and Excel date cells. */
export const CAMPUS_TIME_ZONE = 'Asia/Phnom_Penh';

export interface CampusDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function toIsoDate(value: Date = new Date()): string {
  return value.toISOString();
}

/** Calendar parts of an instant in the campus timezone (month is 1–12). */
export function campusDateParts(
  date: Date,
  timeZone = CAMPUS_TIME_ZONE,
): CampusDateParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function isSameCampusDay(left: Date, right: Date): boolean {
  const a = campusDateParts(left);
  const b = campusDateParts(right);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
