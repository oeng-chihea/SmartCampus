/** Spoken phrases that mean every eligible live class, not one named class. */
const MARK_ALL_PHRASES = new Set([
  'all',
  'all of them',
  'all sessions',
  'all classes',
  'all live classes',
  'all live sessions',
  'every class',
  'every session',
  'every live class',
  'the rest',
  'remaining',
  'the remaining',
  'everything',
  'mark all',
  'mark them all',
  'mark all of them',
  'mark every class',
  'mark every session',
  'mark me present for all',
  'mark me present for all of them',
  'mark me present for every class',
]);

export function isMarkAllVoiceRequest(args: {
  all?: boolean | string;
  query?: string;
}): boolean {
  if (args.all === true || args.all === 'true') {
    return true;
  }
  const query = String(args.query ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return Boolean(query) && MARK_ALL_PHRASES.has(query);
}

export function speakMarkAllResult(input: {
  markedTitles: string[];
  skippedRecordedTitles: string[];
  skippedDueTitles: string[];
  locationBlocked: boolean;
  error: string | null;
}): string {
  const marked = speakCount(
    input.markedTitles,
    'Marked',
    'live class',
    'live classes',
  );
  const recorded = speakCount(
    input.skippedRecordedTitles,
    'Skipped',
    'already recorded',
    'already recorded',
  );
  const due = input.skippedDueTitles.length
    ? `Skipped ${input.skippedDueTitles.length} because due passed${names(
        input.skippedDueTitles,
      )}.`
    : '';
  const location = input.locationBlocked
    ? input.markedTitles.length
      ? 'Location is blocked. Allow location, then say mark all again for the rest.'
      : 'Location is blocked. Allow location on this phone, then say try again or mark all again. Without location the check-in cannot be sent.'
    : '';
  const error = input.error ? input.error : '';

  if (
    !input.markedTitles.length &&
    !input.locationBlocked &&
    !input.error
  ) {
    if (input.skippedRecordedTitles.length && !input.skippedDueTitles.length) {
      return 'Every live class is already recorded.';
    }
    if (!input.skippedRecordedTitles.length && !input.skippedDueTitles.length) {
      return 'No live class is open yet. Ask your teacher to create a session.';
    }
    return ['There is no live class left to mark present.', recorded, due]
      .filter(Boolean)
      .join(' ');
  }

  return [marked, recorded, due, location, error].filter(Boolean).join(' ');
}

function speakCount(
  titles: string[],
  verb: string,
  singular: string,
  plural: string,
): string {
  if (!titles.length) {
    return '';
  }
  const noun = titles.length === 1 ? singular : plural;
  return `${verb} ${titles.length} ${noun}${names(titles)}.`;
}

function names(titles: string[]): string {
  if (!titles.length) {
    return '';
  }
  return `: ${titles.join(', ')}`;
}
