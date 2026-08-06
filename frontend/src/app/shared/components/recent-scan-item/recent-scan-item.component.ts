import { Component, computed, input } from '@angular/core';
import { RecentScan } from '../../../services/dashboard.service';

@Component({
  selector: 'app-recent-scan-item',
  templateUrl: './recent-scan-item.component.html',
  styleUrl: './recent-scan-item.component.scss',
})
export class RecentScanItemComponent {
  readonly scan = input.required<RecentScan>();

  readonly statusClass = computed(() =>
    this.scan()
      .status.toLowerCase()
      .replace(/\s+/g, '-'),
  );
}
