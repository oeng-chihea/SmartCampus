import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateStudentRequest } from '../../../models/student.model';

/**
 * Admin form that creates a student profile AND a login account.
 * Emits `create` with the account payload; the page owns the API call.
 */
@Component({
  selector: 'app-student-form-card',
  imports: [FormsModule],
  templateUrl: './student-form-card.component.html',
  styleUrl: './student-form-card.component.scss',
})
export class StudentFormCardComponent {
  /** Existing class names to pick from (e.g. SE401). */
  readonly courseOptions = input<string[]>([]);
  readonly create = output<CreateStudentRequest>();
  readonly cancel = output<void>();

  name = '';
  studentId = '';
  email = '';
  course = '';
  year = '';
  password = '';

  submit(): void {
    this.create.emit({
      name: this.name.trim(),
      studentId: this.studentId.trim(),
      email: this.email.trim(),
      course: this.course.trim() || this.courseOptions()[0] || '',
      year: this.year.trim(),
      password: this.password,
    });
  }
}
