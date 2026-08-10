import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import {
  AdminAttendanceFilterRequest,
  AdminAttendanceResponse,
  AttendanceFilterState,
} from '../models/attendance.model';
import { AuthService } from './auth.service';

const DEFAULT_FILTERS: AttendanceFilterState = {
  search: '',
  sessionId: 'all',
  status: 'all',
  date: 'all',
};

/**
 * Live Nest attendance log for the admin/teacher records page.
 * Filtering (search, session, status, date) happens server-side; the
 * request body mirrors the backend `AdminAttendanceFilterDto`.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  fetchAdminRecords(
    filters: Partial<AttendanceFilterState> = {},
  ): Promise<AdminAttendanceResponse> {
    const state = { ...DEFAULT_FILTERS, ...filters };
    const body = this.toFilterRequest(state);

    return firstValueFrom(
      this.http.post<AdminAttendanceResponse>(
        this.url(API_ENDPOINTS.attendanceAdmin),
        body,
        { headers: this.authHeaders() },
      ),
    );
  }

  /** Drop UI `all`/empty values so the payload only carries real filters. */
  private toFilterRequest(
    state: AttendanceFilterState,
  ): AdminAttendanceFilterRequest {
    const request: AdminAttendanceFilterRequest = {};

    if (state.search.trim()) {
      request.search = state.search.trim();
    }
    if (state.sessionId !== 'all') {
      request.sessionId = state.sessionId;
    }
    if (state.status !== 'all') {
      request.status = state.status as AdminAttendanceFilterRequest['status'];
    }
    if (state.date !== 'all') {
      request.date = state.date as AdminAttendanceFilterRequest['date'];
    }

    return request;
  }

  mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the API. Start the Nest backend (port 3000) and use the Angular dev server so /api is proxied.';
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
