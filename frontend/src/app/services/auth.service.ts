import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_ENDPOINTS } from '../core/constants/api-endpoints';
import { authLoginPath } from '../core/constants/app-routes';
import { unreachableApiMessage } from '../core/utils/http-error.util';
import { environment } from '../../environments/environment';
import { AuthSession, LoginRequest } from '../models/auth.model';
import { User, UserRole } from '../models/user.model';

const STORAGE_KEY = 'smartcampus_auth_session';

const LOGIN_ROLES: UserRole[] = ['teacher', 'student'];

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; message: string };

/**
 * Auth against Nest `POST /api/auth/login`.
 * Session (token + user) is stored in localStorage for guards and API calls.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly role = computed(() => this.sessionSignal()?.user.role ?? null);

  /** Bearer token for protected API calls, or null when logged out. */
  getAccessToken(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  isLoginRole(value: string | null | undefined): value is UserRole {
    return !!value && LOGIN_ROLES.includes(value as UserRole);
  }

  /**
   * Sign-in URL for a role portal.
   * Defaults to student when role is unknown (no shared chooser page).
   */
  loginPathForRole(role?: UserRole | null): string {
    if (role && this.isLoginRole(role)) {
      return authLoginPath(role);
    }
    return authLoginPath('student');
  }

  /**
   * Login via Nest API. When `expectedRole` is set (role-specific portal),
   * rejects accounts whose role does not match that portal.
   */
  async login(
    credentials: LoginRequest,
    expectedRole?: UserRole,
  ): Promise<LoginResult> {
    const email = credentials.email.trim().toLowerCase();
    const password = credentials.password;

    if (!email || !password) {
      return { ok: false, message: 'Email and password are required.' };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthSession>(
          `${environment.apiBaseUrl}${API_ENDPOINTS.authLogin}`,
          { email, password },
        ),
      );

      if (!response?.accessToken || !response?.user) {
        return {
          ok: false,
          message: 'Login response was incomplete. Check the backend.',
        };
      }

      if (expectedRole && response.user.role !== expectedRole) {
        return {
          ok: false,
          message: `This page is for ${expectedRole} accounts only. Use the ${response.user.role} sign-in page.`,
        };
      }

      const session: AuthSession = {
        accessToken: response.accessToken,
        user: response.user,
      };
      this.persist(session);
      this.sessionSignal.set(session);
      return { ok: true, user: session.user };
    } catch (error) {
      return { ok: false, message: this.mapLoginError(error) };
    }
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.sessionSignal.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const current = this.role();
    return current !== null && roles.includes(current);
  }

  homePathForRole(role: UserRole): string {
    if (role === 'student') {
      return '/student/scan';
    }
    return '/dashboard';
  }

  private mapLoginError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return unreachableApiMessage();
      }
      if (error.status === 401) {
        return 'Invalid email or password.';
      }
      const body = error.error as { message?: string | string[] } | null;
      if (typeof body?.message === 'string') {
        return body.message;
      }
      if (Array.isArray(body?.message)) {
        return body.message.join(', ');
      }
    }
    return 'Sign in failed. Please try again.';
  }

  private persist(session: AuthSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed?.accessToken || !parsed?.user?.role) {
        return null;
      }
      if (!LOGIN_ROLES.includes(parsed.user.role)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
