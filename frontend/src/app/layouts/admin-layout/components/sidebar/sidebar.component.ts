import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminNavItem } from '../../../../core/constants/admin-navigation';

@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '[class.sidebar-host--collapsed]': 'collapsed()',
  },
})
export class AdminSidebarComponent {
  readonly items = input.required<AdminNavItem[]>();
  readonly userLabel = input('');
  readonly collapsed = input(false);
  readonly logout = output<void>();
  readonly collapseToggle = output<void>();
}
