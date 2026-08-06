import { Component, input } from '@angular/core';
import { RecentScan } from '../../../services/dashboard.service';
import { RecentScanItemComponent } from '../recent-scan-item/recent-scan-item.component';

@Component({
  selector: 'app-recent-scan-list',
  imports: [RecentScanItemComponent],
  templateUrl: './recent-scan-list.component.html',
  styleUrl: './recent-scan-list.component.scss',
})
export class RecentScanListComponent {
  readonly scans = input.required<RecentScan[]>();
}
