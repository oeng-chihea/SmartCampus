import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceFilterState, AttendanceFilters } from '../../../models/attendance.model';

@Component({
  selector: 'app-attendance-filter',
  imports: [FormsModule],
  templateUrl: './attendance-filter.component.html',
  styleUrl: './attendance-filter.component.scss',
})
export class AttendanceFilterComponent {
  readonly filters = input.required<AttendanceFilters>();
  readonly apply = output<AttendanceFilterState>();

  readonly search = signal('');
  readonly session = signal('All sessions');
  readonly status = signal('All statuses');
  readonly date = signal('All dates');

  submit(): void {
    this.apply.emit({
      search: this.search(),
      session: this.session(),
      status: this.status(),
      date: this.date(),
    });
  }
}
