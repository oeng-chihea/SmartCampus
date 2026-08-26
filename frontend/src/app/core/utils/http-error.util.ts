import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export function unreachableApiMessage(): string {
  if (environment.production) {
    return 'Cannot reach the API. Wait about a minute if the server is waking up, then try again.';
  }
  return 'Cannot reach the API. Start the Nest backend (port 3000) and use the Angular dev server so /api is proxied.';
}

function firstMessage(
  message: string | string[] | undefined,
  fallback: string,
): string {
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if (Array.isArray(message) && message.length > 0) {
    return message.join(', ');
  }
  return fallback;
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') {
    return fallback;
  }
  return firstMessage(
    (body as { message?: string | string[] }).message,
    fallback,
  );
}

/** Map Nest / proxy HTTP failures, including blob error bodies from file downloads. */
export async function messageFromHttpError(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return unreachableApiMessage();
  }
  if (error.status === 401) {
    return 'Session expired. Sign out and sign in again.';
  }
  if (error.error instanceof Blob) {
    try {
      return messageFromBody(JSON.parse(await error.error.text()), fallback);
    } catch {
      return fallback;
    }
  }
  return messageFromBody(error.error, fallback);
}
