import { Component, input } from '@angular/core';

@Component({
  selector: 'app-student-form-card',
  templateUrl: './student-form-card.component.html',
  styleUrl: './student-form-card.component.scss',
})
export class StudentFormCardComponent {
  /** Class list from mock data (no hard-coded options in the template). */
  readonly courseOptions = input<string[]>([]);
}
