import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocationFilterState, LocationFilters } from '../../../models/location.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';

@Component({
  selector: 'app-location-filter',
  imports: [FormsModule, SelectDropdownComponent],
  templateUrl: './location-filter.component.html',
  styleUrl: './location-filter.component.scss',
})
export class LocationFilterComponent {
  readonly filters = input.required<LocationFilters>();
  readonly apply = output<LocationFilterState>();

  readonly search = signal('');
  readonly building = signal('All buildings');
  readonly status = signal('All statuses');

  submit(): void {
    this.apply.emit({
      search: this.search(),
      building: this.building(),
      status: this.status(),
    });
  }
}
