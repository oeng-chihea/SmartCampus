import { Component, input, output } from '@angular/core';
import { Student } from '../../../models/student.model';

@Component({
  selector: 'app-student-table',
  templateUrl: './student-table.component.html',
  styleUrl: './student-table.component.scss',
})
export class StudentTableComponent {
  readonly students = input.required<Student[]>();
  readonly deletingStudentId = input<string | null>(null);
  readonly loginToggle = output<string>();
  readonly studentEdit = output<Student>();
  readonly studentDelete = output<Student>();

  onToggle(studentId: string): void {
    this.loginToggle.emit(studentId);
  }

  onStudentDelete(student: Student): void {
    this.studentDelete.emit(student);
  }

  onStudentEdit(student: Student): void {
    this.studentEdit.emit(student);
  }
}
