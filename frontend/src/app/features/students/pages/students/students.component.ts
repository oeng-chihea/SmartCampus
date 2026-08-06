import { Component, signal } from '@angular/core';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { StudentFilterComponent } from '../../../../shared/components/student-filter/student-filter.component';
import { StudentTableComponent } from '../../../../shared/components/student-table/student-table.component';
import { Student } from '../../../../models/student.model';
import { StudentService } from '../../../../services/student.service';

@Component({
  selector: 'app-students',
  imports: [StatCardComponent, StudentFilterComponent, StudentTableComponent],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
})
export class StudentsComponent {
  private readonly studentService = new StudentService();
  private readonly pageData = this.studentService.getStudentManagement();

  readonly page = this.pageData;

  /** Mutable list so login toggles update the UI (mock state). */
  readonly students = signal<Student[]>(
    this.pageData.students.map((student) => ({ ...student })),
  );

  onLoginToggle(studentId: string): void {
    this.students.update((list) =>
      list.map((student) => {
        if (student.studentId !== studentId) {
          return student;
        }

        const loginEnabled = !student.loginEnabled;
        return {
          ...student,
          loginEnabled,
          // Toggle on = Active (can login), toggle off = Inactive (cannot login)
          status: loginEnabled ? 'Active' : 'Inactive',
        };
      }),
    );
  }
}

