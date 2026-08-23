import { describe, expect, it } from 'vitest';
import {
  isAffirmativeDecision,
  matchVisibleRows,
} from './voice-row-match.util';

const rows = [
  { id: 's1', title: 'Morning CS101' },
  { id: 's2', title: 'Afternoon lab' },
  { id: 's3', title: 'Evening CS101' },
];

describe('matchVisibleRows', () => {
  const opts = {
    rows,
    getId: (row: (typeof rows)[number]) => row.id,
    getLabels: (row: (typeof rows)[number]) => [row.title, row.id],
  };

  it('selects by 1-based position and last row', () => {
    expect(matchVisibleRows({ ...opts, position: 1 }).rows[0].id).toBe('s1');
    expect(matchVisibleRows({ ...opts, lastPosition: true }).rows[0].id).toBe(
      's3',
    );
  });

  it('returns many when a query hits more than one title', () => {
    const result = matchVisibleRows({ ...opts, query: 'CS101' });
    expect(result.kind).toBe('many');
    expect(result.rows.map((row) => row.id)).toEqual(['s1', 's3']);
  });
});

describe('isAffirmativeDecision', () => {
  it('maps spoken yes and no', () => {
    expect(isAffirmativeDecision(true)).toBe(true);
    expect(isAffirmativeDecision('OK')).toBe(true);
    expect(isAffirmativeDecision('cancel')).toBe(false);
    expect(isAffirmativeDecision('maybe')).toBeNull();
  });
});
