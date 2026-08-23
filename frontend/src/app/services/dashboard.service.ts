import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { AdminDashboard } from '../models/dashboard.model';
import { AuthService } from './auth.service';

/**
 * Live Nest dashboard for admin/teacher home.
 * Summary cards, monthly trend, and recent scans come from GET /dashboard.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  fetchAdminDashboard(): Promise<AdminDashboard> {
    return firstValueFrom(
      this.http.get<AdminDashboard>(this.url(API_ENDPOINTS.dashboard), {
        headers: this.authHeaders(),
      }),
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
