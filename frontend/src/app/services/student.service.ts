import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { unreachableApiMessage } from '../core/utils/http-error.util';
import {
  CreateStudentRequest,
  Student,
  StudentDirectoryResponse,
  StudentFilterState,
  UpdateStudentRequest,
} from '../models/student.model';
import { AuthService } from './auth.service';

export {
  buildStudentFilters,
  buildStudentMetrics,
} from '../core/utils/student-stats.util';

/**
 * Live Nest APIs for the teacher Students page:
 * Search the directory, create/update/delete student accounts, and toggle login access.
 */
@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  listStudents(filters?: StudentFilterState): Promise<StudentDirectoryResponse> {
    let params = new HttpParams();
    const search = filters?.search.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (filters?.course && filters.course !== 'all') {
      params = params.set('course', filters.course);
    }
    if (filters?.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    return firstValueFrom(
      this.http.get<StudentDirectoryResponse>(this.url(API_ENDPOINTS.students), {
        headers: this.authHeaders(),
        params,
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

  updateStudent(
    studentId: string,
    request: UpdateStudentRequest,
  ): Promise<Student> {
    return firstValueFrom(
      this.http.patch<Student>(
        this.url(API_ENDPOINTS.studentById(studentId)),
        request,
        { headers: this.authHeaders() },
      ),
    );
  }

  deleteStudent(studentId: string): Promise<Student> {
    return firstValueFrom(
      this.http.delete<Student>(this.url(API_ENDPOINTS.students), {
        body: { studentId },
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
        return unreachableApiMessage();
      }
      if (error.status === 401) {
        return 'Session expired. Sign out and sign in again.';
      }
      if (error.status === 403) {
        return 'You need a teacher account for this action.';
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
