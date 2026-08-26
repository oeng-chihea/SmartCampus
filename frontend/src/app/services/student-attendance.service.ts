import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { unreachableApiMessage } from '../core/utils/http-error.util';
import {
  AttendanceRecord,
  SubmitAttendanceRequest,
} from '../models/attendance.model';
import { OpenLiveSession } from '../models/session.model';
import { AuthService } from './auth.service';

/**
 * Live Nest APIs for the student attendance page.
 * Separate from mock admin `AttendanceService`.
 */
@Injectable({ providedIn: 'root' })
export class StudentAttendanceService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Open class sessions with the same live QR the teacher sees. */
  listOpenSessions(): Promise<OpenLiveSession[]> {
    return firstValueFrom(
      this.http.get<OpenLiveSession[]>(this.url(API_ENDPOINTS.sessionsOpen), {
        headers: this.authHeaders(),
      }),
    );
  }

  submit(body: SubmitAttendanceRequest): Promise<AttendanceRecord> {
    return firstValueFrom(
      this.http.post<AttendanceRecord>(
        this.url(API_ENDPOINTS.attendanceSubmit),
        body,
        { headers: this.authHeaders() },
      ),
    );
  }

  listMine(): Promise<AttendanceRecord[]> {
    return firstValueFrom(
      this.http.get<AttendanceRecord[]>(this.url(API_ENDPOINTS.attendanceMe), {
        headers: this.authHeaders(),
      }),
    );
  }

  isConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }

  /** 403 from submit = the scanned QR token was rejected (expired/rotated/closed). */
  isQrRejected(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 403;
  }

  mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return unreachableApiMessage();
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      if (error.status === 403) {
        const body = error.error as { message?: string | string[] } | null;
        if (typeof body?.message === 'string') {
          return body.message;
        }
        return 'You are not allowed to submit attendance with this account.';
      }
      if (error.status === 409) {
        return 'You already submitted attendance for this session.';
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
