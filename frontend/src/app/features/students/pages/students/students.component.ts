import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { AlertMessage } from '../../../../models/alert.model';
import {
  CreateStudentRequest,
  Student,
  StudentDirectorySummary,
  StudentFilterState,
  StudentFilters,
  UpdateStudentRequest,
} from '../../../../models/student.model';
import { VOICE_RECORD_DETAIL_HINT } from '../../../../core/utils/voice-record-summary.util';
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
import { ModalDialogComponent } from '../../../../shared/components/modal-dialog/modal-dialog.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';
import { StudentFilterComponent } from '../../../../shared/components/student-filter/student-filter.component';
import { StudentFormCardComponent } from '../../../../shared/components/student-form-card/student-form-card.component';
import { StudentTableComponent } from '../../../../shared/components/student-table/student-table.component';

@Component({
  selector: 'app-students',
  imports: [
    AlertComponent,
    ModalDialogComponent,
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
  private loadRequestId = 0;

  readonly title = 'Students';
  readonly subtitle =
    'Authorised accounts that link each attendance scan to the correct student identity.';

  readonly students = signal<Student[]>([]);
  readonly courses = signal<string[]>([]);
  readonly directorySummary = signal<StudentDirectorySummary>({
    totalStudents: 0,
    activeScanners: 0,
    loginEnabledCount: 0,
    needsReview: 0,
  });
  readonly loading = signal(true);
  readonly alert = signal<AlertMessage | null>(null);
  readonly showForm = signal(false);
  readonly studentToEdit = signal<Student | null>(null);
  readonly studentFormError = signal<string | null>(null);
  readonly creatingStudent = signal(false);
  readonly savingStudent = signal(false);
  readonly studentToDelete = signal<Student | null>(null);
  readonly deletingStudentId = signal<string | null>(null);
  readonly filterState = signal<StudentFilterState>({
    search: '',
    course: 'all',
    status: 'all',
  });

  readonly metrics = computed(() => buildStudentMetrics(this.directorySummary()));
  readonly filters = computed<StudentFilters>(() =>
    buildStudentFilters(this.courses()),
  );

  constructor() {
    this.voicePages.register({
      page: 'students',
      startContext: () =>
        `The staff is on Students. ${this.voiceStatusMessage()} ${VOICE_RECORD_DETAIL_HINT}`,
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

  private async load(filters: StudentFilterState = this.filterState()): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.loading.set(true);
    try {
      const directory = await this.studentService.listStudents(filters);
      if (requestId !== this.loadRequestId) {
        return;
      }
      this.students.set(directory.students);
      this.courses.set(directory.courses);
      this.directorySummary.set(directory.summary);
      this.alert.set(null);
    } catch (error) {
      if (requestId !== this.loadRequestId) {
        return;
      }
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not load the student directory.'),
        ),
      );
    } finally {
      if (requestId === this.loadRequestId) {
        this.loading.set(false);
      }
    }
  }

  onFilterApply(state: StudentFilterState): void {
    this.filterState.set(state);
    void this.load(state);
  }

  openStudentForm(): void {
    this.studentToEdit.set(null);
    this.studentFormError.set(null);
    this.showForm.set(true);
  }

  openStudentEdit(student: Student): void {
    if (this.savingStudent() || this.deletingStudentId() === student.studentId) {
      return;
    }
    this.studentToEdit.set(student);
    this.studentFormError.set(null);
    this.showForm.set(true);
  }

  closeStudentForm(): void {
    this.showForm.set(false);
    this.studentToEdit.set(null);
    this.studentFormError.set(null);
  }

  clearStudentFormError(): void {
    this.studentFormError.set(null);
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
      await this.studentService.setLoginEnabled(studentId, next);
      await this.load(this.filterState());
    } catch (error) {
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not update login access.'),
        ),
      );
    }
  }

  async onStudentCreated(request: CreateStudentRequest): Promise<void> {
    if (this.creatingStudent()) {
      return;
    }

    this.creatingStudent.set(true);
    this.studentFormError.set(null);
    try {
      await this.studentService.createStudent(request);
      this.closeStudentForm();
      await this.load(this.filterState());
      if (this.alert()?.severity !== 'error') {
        this.alert.set(
          this.alerts.success(`Account created for ${request.name} (${request.studentId}).`),
        );
      }
    } catch (error) {
      this.studentFormError.set(
        this.studentService.mapError(error, 'Could not create the student account.'),
      );
    } finally {
      this.creatingStudent.set(false);
    }
  }

  async onStudentUpdated(request: UpdateStudentRequest): Promise<void> {
    const student = this.studentToEdit();
    if (!student || this.savingStudent()) {
      return;
    }

    this.savingStudent.set(true);
    this.studentFormError.set(null);
    try {
      const updated = await this.studentService.updateStudent(
        student.studentId,
        request,
      );
      this.closeStudentForm();
      await this.load(this.filterState());
      if (this.alert()?.severity !== 'error') {
        this.alert.set(
          this.alerts.success(
            'Updated ' + updated.name + ' (' + updated.studentId + ').',
          ),
        );
      }
    } catch (error) {
      this.studentFormError.set(
        this.studentService.mapError(error, 'Could not update the student profile.'),
      );
    } finally {
      this.savingStudent.set(false);
    }
  }

  requestStudentDeletion(student: Student): void {
    this.studentToDelete.set(student);
  }

  cancelStudentDeletion(): void {
    if (!this.deletingStudentId()) {
      this.studentToDelete.set(null);
    }
  }

  async confirmStudentDeletion(): Promise<void> {
    const student = this.studentToDelete();
    if (!student || this.deletingStudentId()) {
      return;
    }

    this.deletingStudentId.set(student.studentId);
    try {
      const deleted = await this.studentService.deleteStudent(student.studentId);
      this.studentToDelete.set(null);
      await this.load(this.filterState());
      if (this.alert()?.severity !== 'error') {
        this.alert.set(
          this.alerts.success(`Deleted ${deleted.name} (${deleted.studentId}).`),
        );
      }
    } catch (error) {
      this.alert.set(
        this.alerts.error(
          this.studentService.mapError(error, 'Could not delete the student account.'),
        ),
      );
    } finally {
      this.deletingStudentId.set(null);
    }
  }

  private async voiceControl(args: VoiceControlArgs): Promise<VoiceToolResult> {
    if (args.action === 'open_create') {
      this.openStudentForm();
      return { ok: true, message: 'Opened the add student account form.' };
    }
    if (args.action === 'refresh' || args.action === 'status') {
      if (args.action === 'refresh') {
        await this.load();
      }
      return { ok: true, message: this.voiceStatusMessage() };
    }
    if (args.action === 'search' && args.query) {
      return this.voiceSelect({ query: args.query });
    }
    return { ok: false, message: 'On Students I can search, add an account, or toggle login.' };
  }

  private voiceStatusMessage(): string {
    const summary = this.directorySummary();
    return `${summary.totalStudents} students in the directory, ${summary.loginEnabledCount} can log in.`;
  }

  private async voiceSelect(args: VoiceSelectArgs): Promise<VoiceToolResult> {
    let rows = this.students();
    const query = args.query?.trim();
    if (query) {
      try {
        const directory = await this.studentService.listStudents({
          ...this.filterState(),
          search: query,
        });
        rows = directory.students;
      } catch (error) {
        return {
          ok: false,
          message: this.studentService.mapError(
            error,
            'Could not search the student directory.',
          ),
        };
      }
    }

    const match = matchVisibleRows({
      rows,
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
      this.openStudentForm();
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
