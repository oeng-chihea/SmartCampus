import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import {
  CreateStudentRequest,
  Student,
} from '../models/student.model';
import { AuthService } from './auth.service';

export {
  buildStudentFilters,
  buildStudentMetrics,
} from '../core/utils/student-stats.util';

/**
 * Live Nest APIs for the admin Students page:
 * list the directory, create a student (+ login account), toggle login access.
 */
@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  listStudents(): Promise<Student[]> {
    return firstValueFrom(
      this.http.get<Student[]>(this.url(API_ENDPOINTS.students), {
        headers: this.authHeaders(),
      }),
    );
  }

  createStudent(request: CreateStudentRequest): Promise<Student> {
    return firstValueFrom(
      this.http.post<Student>(this.url(API_ENDPOINTS.students), request, {
        headers: this.authHeaders(),
      }),
    );
  }

  setLoginEnabled(studentId: string, loginEnabled: boolean): Promise<Student> {
    return firstValueFrom(
      this.http.patch<Student>(
        this.url(API_ENDPOINTS.studentAccess(studentId)),
        { loginEnabled },
        { headers: this.authHeaders() },
      ),
    );
  }

  mapError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Cannot reach the API. Start the Nest backend (port 3000) and use the Angular dev server so /api is proxied.';
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      if (error.status === 403) {
        return 'You need admin access for this action.';
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
