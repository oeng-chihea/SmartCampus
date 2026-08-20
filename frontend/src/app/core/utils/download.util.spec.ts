import { describe, expect, it } from 'vitest';
import { filenameFromContentDisposition } from './download.util';

describe('filenameFromContentDisposition', () => {
  it('reads a quoted attachment filename', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="location-visits-2026-08-20.xlsx"',
        'fallback.xlsx',
      ),
    ).toBe('location-visits-2026-08-20.xlsx');
  });

  it('falls back when the header is missing', () => {
    expect(filenameFromContentDisposition(null, 'attendance-records.xlsx')).toBe(
      'attendance-records.xlsx',
    );
  });
});
