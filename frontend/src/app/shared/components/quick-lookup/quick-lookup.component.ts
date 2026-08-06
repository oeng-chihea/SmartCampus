import { Component, input } from '@angular/core';
import { QuickFilter } from '../../../services/dashboard.service';

@Component({
  selector: 'app-quick-lookup',
  templateUrl: './quick-lookup.component.html',
  styleUrl: './quick-lookup.component.scss',
})
export class QuickLookupComponent {
  readonly quickFilter = input.required<QuickFilter>();
}
