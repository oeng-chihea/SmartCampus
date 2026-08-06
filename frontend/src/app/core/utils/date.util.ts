export function formatDate(value: string | Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale).format(new Date(value));
}
