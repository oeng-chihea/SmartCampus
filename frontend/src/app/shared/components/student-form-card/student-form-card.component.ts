import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateStudentRequest,
  Student,
  UpdateStudentRequest,
} from '../../../models/student.model';
import { SelectDropdownComponent } from '../select-dropdown/select-dropdown.component';
import { SelectOption } from '../select-dropdown/select-dropdown.model';

/**
 * Student account form.
 * Emits create or update payloads; the page owns API calls and feedback.
 */
@Component({
  selector: 'app-student-form-card',
  imports: [FormsModule, SelectDropdownComponent],
  templateUrl: './student-form-card.component.html',
  styleUrl: './student-form-card.component.scss',
})
export class StudentFormCardComponent implements OnInit {
  /** Existing class names to pick from (e.g. SE401). */
  readonly courseOptions = input<string[]>([]);
  readonly student = input<Student | null>(null);
  readonly editMode = computed(() => this.student() !== null);
  readonly courseSelectOptions = computed<SelectOption[]>(() =>
    this.courseOptions().map((course) => ({ value: course, label: course })),
  );
  readonly errorMessage = input<string | null>(null);
  readonly submitting = input(false);
  readonly validationNotice = signal<string | null>(null);
  readonly create = output<CreateStudentRequest>();
  readonly update = output<UpdateStudentRequest>();
  readonly valueChanged = output<void>();
  readonly cancel = output<void>();

  name = '';
  studentId = '';
  email = '';
  course = '';
  year = '';
  password = '';

  ngOnInit(): void {
    const student = this.student();
    if (student) {
      this.name = student.name;
      this.studentId = student.studentId;
      this.email = student.email;
      this.course = student.course;
      this.year = student.year;
      return;
    }
    this.course = this.courseOptions()[0] ?? '';
  }

  submit(): void {
    if (this.editMode()) {
      if (!this.hasChanges()) {
        this.validationNotice.set(
          'No changes detected. Update at least one field before saving.',
        );
        return;
      }

      this.update.emit({
        studentId: this.studentId.trim(),
        name: this.name.trim(),
        email: this.email.trim(),
        course: this.course.trim(),
        year: this.year.trim(),
      });
      return;
    }

    this.create.emit({
      name: this.name.trim(),
      studentId: this.studentId.trim(),
      email: this.email.trim(),
      course: this.course.trim() || this.courseOptions()[0] || '',
      year: this.year.trim(),
      password: this.password,
    });
  }

  clearValidationNotice(): void {
    this.validationNotice.set(null);
    this.valueChanged.emit();
  }

  private hasChanges(): boolean {
    const student = this.student();
    if (!student) {
      return true;
    }

    return (
      this.studentId.trim().toLowerCase() !==
        student.studentId.trim().toLowerCase() ||
      this.name.trim() !== student.name.trim() ||
      this.email.trim().toLowerCase() !== student.email.trim().toLowerCase() ||
      this.course.trim() !== student.course.trim() ||
      this.year.trim() !== student.year.trim()
    );
  }
}
