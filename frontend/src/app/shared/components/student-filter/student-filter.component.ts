import {
  Component,
  OnDestroy,
  WritableSignal,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StudentFilterState, StudentFilters } from '../../../models/student.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';

@Component({
  selector: 'app-student-filter',
  imports: [FormsModule, SelectDropdownComponent],
  templateUrl: './student-filter.component.html',
  styleUrl: './student-filter.component.scss',
})
export class StudentFilterComponent implements OnDestroy {
  readonly filters = input.required<StudentFilters>();
  readonly apply = output<StudentFilterState>();

  readonly search = signal('');
  readonly course = signal('all');
  readonly status = signal('all');

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => this.submit(), 350);
  }

  onCourseChange(value: string): void {
    this.setAndApply(this.course, value);
  }

  onStatusChange(value: string): void {
    this.setAndApply(this.status, value);
  }

  private setAndApply(field: WritableSignal<string>, value: string): void {
    if (field() === value) {
      return;
    }
    field.set(value);
    this.submit();
  }

  submit(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    this.apply.emit({
      search: this.search(),
      course: this.course(),
      status: this.status(),
    });
  }
}
