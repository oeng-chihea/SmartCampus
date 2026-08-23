import { Component, computed, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ADMIN_NAVIGATION, AdminNavItem } from '../../core/constants/admin-navigation';
import { AuthService } from '../../services/auth.service';
import { VoiceAssistantComponent } from '../../shared/components/voice-assistant/voice-assistant.component';
import { AdminSidebarComponent } from './components/sidebar/sidebar.component';

const SIDEBAR_COLLAPSED_KEY = 'smartcampus.admin.sidebarCollapsed';

@Component({
  selector: 'app-admin-layout',
  imports: [AdminSidebarComponent, RouterOutlet, VoiceAssistantComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  host: {
    '[class.sidebar-collapsed]': 'sidebarCollapsed()',
  },
})
export class AdminLayoutComponent {
  /** Admin-only pages hidden from teacher role */
  private readonly adminOnlyPaths = new Set(['/students', '/reports']);

  readonly sidebarCollapsed = signal(this.readCollapsedPreference());

  readonly navigation = computed<AdminNavItem[]>(() => {
    const role = this.auth.role();
    if (role === 'admin') {
      return ADMIN_NAVIGATION;
    }
    return ADMIN_NAVIGATION.filter((item) => !this.adminOnlyPaths.has(item.path));
  });

  readonly userLabel = computed(() => {
    const user = this.auth.user();
    return user ? `${user.name} · ${user.role}` : '';
  });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
    this.persistCollapsedPreference(this.sidebarCollapsed());
  }

  logout(): void {
    const role = this.auth.role();
    this.auth.logout();
    void this.router.navigateByUrl(this.auth.loginPathForRole(role));
  }

  private readCollapsedPreference(): boolean {
    try {
      return globalThis.localStorage?.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private persistCollapsedPreference(collapsed: boolean): void {
    try {
      globalThis.localStorage?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore storage failures (private mode) */
    }
  }
}
