import { Component, computed, inject, signal } from '@angular/core';
import { AlertMessage } from '../../../../models/alert.model';
import { CreateStudentRequest, StudentFilters } from '../../../../models/student.model';
import { AlertService } from '../../../../services/alert.service';
import {
  StudentService,
  buildStudentFilters,
  buildStudentMetrics,
} from '../../../../services/student.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { StudentFilterComponent } from '../../../../shared/components/student-filter/student-filter.component';
import { StudentFormCardComponent } from '../../../../shared/components/student-form-card/student-form-card.component';
import { StudentTableComponent } from '../../../../shared/components/student-table/student-table.component';
import { Student } from '../../../../models/student.model';

@Component({
  selector: 'app-students',
  imports: [
    AlertComponent,
    StatCardComponent,
    StudentFilterComponent,
    StudentFormCardComponent,
    StudentTableComponent,
  ],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent {
  private readonly studentService = inject(StudentService);
  private readonly alerts = inject(AlertService);

  readonly title = 'Students';
  readonly subtitle =
    'Authorised accounts that link each attendance scan to the correct student identity.';

  readonly students = signal<Student[]>([]);
  readonly loading = signal(true);
  readonly alert = signal<AlertMessage | null>(null);
  readonly showForm = signal(false);

  readonly metrics = computed(() => buildStudentMetrics(this.students()));
  readonly filters = computed<StudentFilters>(() =>
    buildStudentFilters(this.students()),
  );

  /** Course list for the “Add student” form (no “All classes” option). */
  readonly formCourseOptions = computed<string[]>(() => {
    const courses = new Set(
      this.students()
        .map((student) => student.course)
        .filter(Boolean),
    );
    return [...courses];
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.students.set(await this.studentService.listStudents());
      this.alert.set(null);
    } catch (error) {
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not load the student directory.'),
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  async onLoginToggle(studentId: string): Promise<void> {
    const student = this.students().find((row) => row.studentId === studentId);
    if (!student) {
      return;
    }

    const next = !student.loginEnabled;
    if (next && !student.hasAccount) {
      this.alert.set(
        this.alerts.error(
          'This student has no login account yet. Use the “Add student account” form to create one.',
        ),
      );
      return;
    }

    try {
      const updated = await this.studentService.setLoginEnabled(studentId, next);
      this.students.update((list) =>
        list.map((row) =>
          row.studentId === studentId
            ? {
                ...row,
                loginEnabled: updated.loginEnabled,
                // Toggle on = Active (can login), toggle off = Inactive (cannot login)
                status: updated.loginEnabled ? 'Active' : 'Inactive',
              }
            : row,
        ),
      );
      this.alert.set(null);
    } catch (error) {
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not update login access.'),
        ),
      );
    }
  }

  async onStudentCreated(request: CreateStudentRequest): Promise<void> {
    try {
      await this.studentService.createStudent(request);
      this.showForm.set(false);
      this.alert.set(
        this.alerts.success(`Account created for ${request.name} (${request.studentId}).`),
      );
      await this.load();
    } catch (error) {
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not create the student account.'),
        ),
      );
    }
  }
}
