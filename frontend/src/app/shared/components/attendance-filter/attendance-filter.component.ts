import {
  Component,
  OnDestroy,
  WritableSignal,
  input,
  output,
  signal,
} from '@angular/core';
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
export class AttendanceFilterComponent implements OnDestroy {
  readonly filters = input.required<AttendanceFilterOptions>();
  readonly apply = output<AttendanceFilterState>();

  readonly search = signal('');
  readonly sessionId = signal('all');
  readonly sessionLabel = signal(ALL_SESSIONS_LABEL);
  readonly status = signal('all');
  readonly attendanceStatus = signal('all');
  readonly date = signal('all');

  readonly pickerOpen = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

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
    this.submit();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.submit(), 350);
  }

  onStatusChange(value: string): void {
    this.setAndApply(this.status, value);
  }

  onAttendanceStatusChange(value: string): void {
    this.setAndApply(this.attendanceStatus, value);
  }

  onDateChange(value: string): void {
    this.setAndApply(this.date, value);
  }

  private setAndApply(field: WritableSignal<string>, value: string): void {
    if (field() === value) {
      return;
    }
    field.set(value);
    this.submit();
  }

  submit(): void {
    this.apply.emit({
      search: this.search(),
      sessionId: this.sessionId(),
      status: this.status(),
      attendanceStatus: this.attendanceStatus(),
      date: this.date(),
    });
  }

  applyFromVoice(patch: Partial<AttendanceFilterState>): void {
    if (patch.search !== undefined) {
      this.search.set(patch.search);
    }
    if (patch.status) {
      this.status.set(patch.status);
    }
    if (patch.attendanceStatus) {
      this.attendanceStatus.set(patch.attendanceStatus);
    }
    if (patch.date) {
      this.date.set(patch.date);
    }
    this.submit();
  }
}
