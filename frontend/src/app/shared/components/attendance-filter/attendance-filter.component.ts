import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttendanceFilterOptions,
  AttendanceFilterState,
} from '../../../models/attendance.model';
import { SessionPickerSelection } from '../../../models/session.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';
import { SessionPickerDialogComponent } from '../session-picker-dialog/session-picker-dialog.component';

const ALL_SESSIONS_LABEL = 'All sessions';

@Component({
  selector: 'app-attendance-filter',
  imports: [FormsModule, SelectDropdownComponent, SessionPickerDialogComponent],
  templateUrl: './attendance-filter.component.html',
  styleUrl: './attendance-filter.component.scss',
})
export class AttendanceFilterComponent {
  readonly filters = input.required<AttendanceFilterOptions>();
  readonly apply = output<AttendanceFilterState>();

  readonly search = signal('');
  readonly sessionId = signal('all');
  readonly sessionLabel = signal(ALL_SESSIONS_LABEL);
  readonly status = signal('all');
  readonly date = signal('all');

  readonly pickerOpen = signal(false);

  openSessionPicker(): void {
    this.pickerOpen.set(true);
  }

  closeSessionPicker(): void {
    this.pickerOpen.set(false);
  }

  onSessionConfirmed(selection: SessionPickerSelection): void {
    this.sessionId.set(selection.id);
    this.sessionLabel.set(selection.title || ALL_SESSIONS_LABEL);
    this.pickerOpen.set(false);
    // Apply immediately so POST /attendance/admin runs with sessionId
    // (user should not need a second click on Apply after Use session).
    this.submit();
  }

  submit(): void {
    this.apply.emit({
      search: this.search(),
      sessionId: this.sessionId(),
      status: this.status(),
      date: this.date(),
    });
  }
}
