import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttendanceFilterOptions,
  AttendanceFilterState,
} from '../../../models/attendance.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';

@Component({
  selector: 'app-attendance-filter',
  imports: [FormsModule, SelectDropdownComponent],
  templateUrl: './attendance-filter.component.html',
  styleUrl: './attendance-filter.component.scss',
})
export class AttendanceFilterComponent {
  readonly filters = input.required<AttendanceFilterOptions>();
  readonly apply = output<AttendanceFilterState>();

  readonly search = signal('');
  readonly sessionId = signal('all');
  readonly status = signal('all');
  readonly date = signal('all');

  submit(): void {
    this.apply.emit({
      search: this.search(),
      sessionId: this.sessionId(),
      status: this.status(),
      date: this.date(),
    });
  }
}
