import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { CampusLocation } from '../models/location.model';
import {
  AttendanceSession,
  CreateSessionRequest,
  SessionQrResponse,
} from '../models/session.model';
import { AuthService } from './auth.service';

/**
 * Live Nest sessions + locations for teacher session creation and short-lived QR.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  listSessions(): Promise<AttendanceSession[]> {
    return firstValueFrom(
      this.http.get<AttendanceSession[]>(this.url(API_ENDPOINTS.sessions), {
        headers: this.authHeaders(),
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
        return 'Cannot reach the API. Start the backend on port 3000.';
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
