import { campusDateParts, isSameCampusDay } from './date.util';

describe('campusDateParts', () => {
  it('converts a UTC instant to Asia/Phnom_Penh wall-clock', () => {
    // 16:30 UTC = 23:30 in Cambodia (UTC+7).
    expect(campusDateParts(new Date('2026-08-20T16:30:00.000Z'))).toEqual({
      year: 2026,
      month: 8,
      day: 20,
      hour: 23,
      minute: 30,
      second: 0,
    });
  });
});

describe('isSameCampusDay', () => {
  it('groups instants that share the campus calendar day', () => {
    expect(
      isSameCampusDay(
        new Date('2026-08-20T16:30:00.000Z'),
        new Date('2026-08-20T13:12:00.000Z'),
      ),
    ).toBe(true);
  });

  it('splits instants that fall on different campus days', () => {
    // 17:00 UTC 19 Aug = 00:00 20 Aug Cambodia; 16:30 UTC 19 Aug = 23:30 19 Aug.
    expect(
      isSameCampusDay(
        new Date('2026-08-19T16:30:00.000Z'),
        new Date('2026-08-19T17:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
