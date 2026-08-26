import { describe, expect, it } from 'vitest';
import {
  isMarkAllVoiceRequest,
  speakMarkAllResult,
} from './voice-mark-all.util';

describe('isMarkAllVoiceRequest', () => {
  it('treats the all flag and spoken all phrases as mark every class', () => {
    expect(isMarkAllVoiceRequest({ all: true })).toBe(true);
    expect(isMarkAllVoiceRequest({ all: 'true' })).toBe(true);
    expect(isMarkAllVoiceRequest({ query: 'mark them all' })).toBe(true);
    expect(isMarkAllVoiceRequest({ query: 'every class' })).toBe(true);
    expect(isMarkAllVoiceRequest({ query: 'the rest' })).toBe(true);
  });

  it('does not treat a named class as mark all', () => {
    expect(isMarkAllVoiceRequest({})).toBe(false);
    expect(isMarkAllVoiceRequest({ all: false, query: 'Morning CS101' })).toBe(
      false,
    );
  });
});

describe('speakMarkAllResult', () => {
  it('names every class that was marked and skips already recorded ones', () => {
    expect(
      speakMarkAllResult({
        markedTitles: ['Morning', 'Lab'],
        skippedRecordedTitles: ['Seminar'],
        skippedDueTitles: [],
        locationBlocked: false,
        error: null,
      }),
    ).toContain('Marked 2 live classes: Morning, Lab.');
    expect(
      speakMarkAllResult({
        markedTitles: [],
        skippedRecordedTitles: ['Morning'],
        skippedDueTitles: [],
        locationBlocked: false,
        error: null,
      }),
    ).toBe('Every live class is already recorded.');
  });
});
