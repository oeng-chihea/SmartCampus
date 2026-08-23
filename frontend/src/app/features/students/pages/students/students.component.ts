import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AlertMessage } from '../../../../models/alert.model';
import { CreateStudentRequest, StudentFilters } from '../../../../models/student.model';
import {
  describeMatches,
  matchVisibleRows,
} from '../../../../core/utils/voice-row-match.util';
import {
  VoiceActArgs,
  VoiceConfirmArgs,
  VoiceControlArgs,
  VoiceSelectArgs,
  VoiceToolResult,
} from '../../../../models/voice-live.model';
import { AlertService } from '../../../../services/alert.service';
import { VoicePageRegistry } from '../../../../services/voice-page-registry.service';
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
export class StudentsComponent implements OnDestroy {
  private readonly studentService = inject(StudentService);
  private readonly alerts = inject(AlertService);
  private readonly voicePages = inject(VoicePageRegistry);
  private pendingDisableId: string | null = null;

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
    this.voicePages.register({
      page: 'students',
      startContext: () =>
        `The staff is on Students. ${this.students().length} students in the directory.`,
      control: (args) => this.voiceControl(args),
      select: (args) => this.voiceSelect(args),
      act: (args) => this.voiceAct(args),
      confirm: (args) => this.voiceConfirm(args),
    });
    void this.load();
  }

  ngOnDestroy(): void {
    this.voicePages.unregister('students');
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

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    if (args.action === 'open_create') {
      this.showForm.set(true);
      return { ok: true, message: 'Opened the add student account form.' };
    }
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.load();
      }
      return { ok: true, message: `${this.students().length} students in the directory.` };
    }
    if (args.action === 'search' && args.query) {
      return this.voiceSelect({ query: args.query });
    }
    return { ok: false, message: 'On Students I can search, add an account, or toggle login.' };
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    const match = matchVisibleRows({
      rows: this.students(),
      getId: (row) => row.studentId,
      getLabels: (row) => [row.name, row.studentId, row.email],
      rowId: args.row_id,
      query: args.query,
      position: args.position,
      lastPosition: args.last_position,
    });
    if (match.kind === 'none') {
      return { ok: false, message: 'Student not found. Say the name or student ID.' };
    }
    if (match.kind === 'many') {
      return {
        ok: false,
        message: `Several students match. ${describeMatches(match.rows, (row) => `${row.name} ${row.studentId}`)}`,
      };
    }
    const student = match.rows[0];
    return {
      ok: true,
      message: `Selected ${student.name}.`,
      item_summary: `${student.name} ${student.studentId}`,
      selected_id: student.studentId,
    };
  }

  private async voiceAct(args: VoiceActArgs): Promise<VoiceToolResult> {
    if (args.action === 'open_add_student') {
      this.showForm.set(true);
      return { ok: true, message: 'Opened the add student account form.' };
    }
    if (args.action !== 'toggle_login') {
      return { ok: false, message: 'On Students I can add an account or toggle login.' };
    }
    const selected = await this.voiceSelect(args);
    if (!selected.ok || !selected.selected_id) {
      return selected;
    }
    const student = this.students().find((row) => row.studentId === selected.selected_id);
    if (!student) {
      return { ok: false, message: 'Student not found.' };
    }
    if (student.loginEnabled) {
      this.pendingDisableId = student.studentId;
      return {
        ok: true,
        confirmation_required: true,
        message: `Disable login for ${student.name}? Say yes or no.`,
        item_summary: `${student.name} ${student.studentId}`,
      };
    }
    await this.onLoginToggle(student.studentId);
    return {
      ok: true,
      message: `Enabled login for ${student.name}.`,
      item_summary: `${student.name} ${student.studentId}`,
    };
  }

  private async voiceConfirm(args: VoiceConfirmArgs): Promise<VoiceToolResult> {
    if (!args.confirm) {
      this.pendingDisableId = null;
      return { ok: true, message: 'Cancelled.' };
    }
    if (!this.pendingDisableId) {
      return { ok: false, message: 'Nothing is waiting for confirmation.' };
    }
    const studentId = this.pendingDisableId;
    this.pendingDisableId = null;
    const student = this.students().find((row) => row.studentId === studentId);
    await this.onLoginToggle(studentId);
    return {
      ok: true,
      message: `Disabled login for ${student?.name ?? studentId}.`,
      item_summary: student ? `${student.name} ${student.studentId}` : studentId,
    };
  }
}
