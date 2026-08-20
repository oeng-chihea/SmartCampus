import {
  Component,
  OnDestroy,
  WritableSignal,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocationFilterState, LocationFilters } from '../../../models/location.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';

@Component({
  selector: 'app-location-filter',
  imports: [FormsModule, SelectDropdownComponent],
  templateUrl: './location-filter.component.html',
  styleUrl: './location-filter.component.scss',
})
export class LocationFilterComponent implements OnDestroy {
  readonly filters = input.required<LocationFilters>();
  readonly apply = output<LocationFilterState>();

  readonly search = signal('');
  readonly building = signal('All buildings');
  readonly status = signal('All statuses');

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

  onBuildingChange(value: string): void {
    this.setAndApply(this.building, value);
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
    this.apply.emit({
      search: this.search(),
      building: this.building(),
      status: this.status(),
    });
  }
}
