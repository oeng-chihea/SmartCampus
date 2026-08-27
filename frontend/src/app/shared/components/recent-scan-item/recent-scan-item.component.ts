import { Component, computed, input } from '@angular/core';
import { formatRecentScanTime } from '../../../core/utils/date.util';
import { formatGeofenceStatus, geofenceBadgeVariant } from '../../../core/utils/format.util';
import { RecentScan } from '../../../models/dashboard.model';

@Component({
  selector: 'app-recent-scan-item',
  templateUrl: './recent-scan-item.component.html',
  styleUrl: './recent-scan-item.component.scss',
})
export class RecentScanItemComponent {
  readonly scan = input.required<RecentScan>();

  readonly statusLabel = computed(() => formatGeofenceStatus(this.scan().status));

  readonly statusClass = computed(() => geofenceBadgeVariant(this.scan().status));

  readonly recordedLabel = computed(() => formatRecentScanTime(this.scan().recordedAt));
}
