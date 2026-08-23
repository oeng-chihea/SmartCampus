import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RecentScan } from '../../../models/dashboard.model';
import { RecentScanItemComponent } from '../recent-scan-item/recent-scan-item.component';

@Component({
  selector: 'app-recent-scan-list',
  imports: [RecentScanItemComponent, RouterLink],
  templateUrl: './recent-scan-list.component.html',
  styleUrl: './recent-scan-list.component.scss',
})
export class RecentScanListComponent {
  readonly scans = input.required<RecentScan[]>();
  readonly loading = input(false);
  readonly reviewAllHref = input('/attendance');
  readonly loadingMessage = input('Loading recent scans…');
  readonly emptyTitle = input('No student scans yet');
  readonly emptyMessage = input(
    'When a student marks present, the latest scans will appear here.',
  );
}
