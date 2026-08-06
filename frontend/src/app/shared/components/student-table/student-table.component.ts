import { Component, input, output } from '@angular/core';
import { Student } from '../../../models/student.model';

@Component({
  selector: 'app-student-table',
  templateUrl: './student-table.component.html',
  styleUrl: './student-table.component.scss',
})
export class StudentTableComponent {
  readonly students = input.required<Student[]>();
  readonly loginToggle = output<string>();

  onToggle(studentId: string): void {
    this.loginToggle.emit(studentId);
  }
}
