import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { unreachableApiMessage } from '../core/utils/http-error.util';
import { CampusLocation } from '../models/location.model';
import {
  AttendanceSession,
  CreateSessionRequest,
  EditSessionRequest,
  ListSessionsPageParams,
  PaginatedSessionsResponse,
  SessionQrResponse,
} from '../models/session.model';
import { AuthService } from './auth.service';

/** Default page size for the attendance session picker modal. */
export const SESSION_PICKER_PAGE_SIZE = 10;

/**
 * Live Nest sessions + locations for teacher session creation and short-lived QR.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Full list (Sessions page). No page/limit query → array response. */
  listSessions(): Promise<AttendanceSession[]> {
    return firstValueFrom(
      this.http.get<AttendanceSession[]>(this.url(API_ENDPOINTS.sessions), {
        headers: this.authHeaders(),
      }),
    );
  }

  /**
   * Paginated list for pickers. Always sends page + limit so the API returns
   * `{ items, pagination }` instead of a bare array.
   */
  listSessionsPage(
    params: ListSessionsPageParams = {},
  ): Promise<PaginatedSessionsResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? SESSION_PICKER_PAGE_SIZE;
    let httpParams = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    const q = params.q?.trim();
    if (q) {
      httpParams = httpParams.set('q', q);
    }
    return firstValueFrom(
      this.http.get<PaginatedSessionsResponse>(this.url(API_ENDPOINTS.sessions), {
        headers: this.authHeaders(),
        params: httpParams,
      }),
    );
  }

  createSession(body: CreateSessionRequest): Promise<AttendanceSession> {
    return firstValueFrom(
      this.http.post<AttendanceSession>(this.url(API_ENDPOINTS.sessions), body, {
        headers: this.authHeaders(),
      }),
    );
  }

  /** Update title and campus location via POST /sessions/:id/edit. Due stays as created. */
  editSession(
    sessionId: string,
    body: EditSessionRequest,
  ): Promise<AttendanceSession> {
    return firstValueFrom(
      this.http.post<AttendanceSession>(
        this.url(API_ENDPOINTS.sessionEdit(sessionId)),
        body,
        { headers: this.authHeaders() },
      ),
    );
  }

  getQr(sessionId: string): Promise<SessionQrResponse> {
    return firstValueFrom(
      this.http.get<SessionQrResponse>(
        this.url(API_ENDPOINTS.sessionQr(sessionId)),
        { headers: this.authHeaders() },
      ),
    );
  }

  closeSession(sessionId: string): Promise<AttendanceSession> {
    return firstValueFrom(
      this.http.post<AttendanceSession>(
        this.url(API_ENDPOINTS.sessionClose(sessionId)),
        {},
        { headers: this.authHeaders() },
      ),
    );
  }

  /** Permanently remove a session from the log and backend store. */
  deleteSession(sessionId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(API_ENDPOINTS.sessionDelete(sessionId)), {
        headers: this.authHeaders(),
      }),
    );
  }

  listLocations(): Promise<CampusLocation[]> {
    return firstValueFrom(
      this.http.get<CampusLocation[]>(this.url(API_ENDPOINTS.locations), {
        headers: this.authHeaders(),
      }),
    );
  }

  listActiveLocations(): Promise<CampusLocation[]> {
    return this.listLocations().then((locations) =>
      locations.filter((location) => location.status === 'Active'),
    );
  }

  mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return unreachableApiMessage();
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      const body = error.error as { message?: string | string[] } | null;
      if (typeof body?.message === 'string') {
        return body.message;
      }
      if (Array.isArray(body?.message)) {
        return body.message.join(', ');
      }
    }
    return fallback;
  }

  private url(path: string): string {
    return `${environment.apiBaseUrl}${path}`;
  }

  private authHeaders(): HttpHeaders {
    const token = this.auth.getAccessToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }
}
