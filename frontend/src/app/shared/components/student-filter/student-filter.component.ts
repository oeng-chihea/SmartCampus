import { Component, input } from '@angular/core';
import { StudentFilters } from '../../../models/student.model';

@Component({
  selector: 'app-student-filter',
  templateUrl: './student-filter.component.html',
  styleUrl: './student-filter.component.scss',
})
export class StudentFilterComponent {
  readonly filters = input.required<StudentFilters>();
}
