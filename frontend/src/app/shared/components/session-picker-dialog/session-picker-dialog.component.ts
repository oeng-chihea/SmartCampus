import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatSessionOpened } from '../../../core/utils/date.util';
import { formatCampusLocationLabel } from '../../../core/utils/format.util';
import {
  AttendanceSession,
  SessionPickerSelection,
  SessionsPageMeta,
} from '../../../models/session.model';
import {
  SESSION_PICKER_PAGE_SIZE,
  SessionService,
} from '../../../services/session.service';
import { ModalDialogComponent } from '../modal-dialog/modal-dialog.component';

const ALL_SESSIONS_ID = 'all';
const ALL_SESSIONS_TITLE = 'All sessions';

/**
 * Modal session picker for attendance filters (option B):
 * select a row, then confirm with **Use session**.
 * Loads paginated sessions (default 10 / page) with optional search.
 */
@Component({
  selector: 'app-session-picker-dialog',
  standalone: true,
  imports: [FormsModule, ModalDialogComponent],
  templateUrl: './session-picker-dialog.component.html',
  styleUrl: './session-picker-dialog.component.scss',
})
export class SessionPickerDialogComponent implements OnInit {
  private readonly sessionService = inject(SessionService);
  private readonly destroyRef = inject(DestroyRef);

  /** Currently applied filter session id (`all` = no filter). */
  readonly selectedId = input<string>(ALL_SESSIONS_ID);

  /** Label for the applied selection (shown until the matching page loads). */
  readonly selectedTitle = input<string>(ALL_SESSIONS_TITLE);

  readonly closed = output<void>();
  readonly confirmed = output<SessionPickerSelection>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<AttendanceSession[]>([]);
  readonly pagination = signal<SessionsPageMeta>({
    page: 1,
    limit: SESSION_PICKER_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  /** Search box text (debounced into `appliedQuery`). */
  readonly searchInput = signal('');
  private readonly appliedQuery = signal('');

  /** Draft selection inside the modal (not applied until Use session). */
  readonly draftId = signal(ALL_SESSIONS_ID);
  readonly draftTitle = signal(ALL_SESSIONS_TITLE);

  readonly rangeLabel = computed(() => {
    const p = this.pagination();
    if (p.total === 0) {
      return 'No sessions';
    }
    const from = (p.page - 1) * p.limit + 1;
    const to = Math.min(p.page * p.limit, p.total);
    return `Showing ${from}–${to} of ${p.total}`;
  });

  readonly canPrev = computed(() => this.pagination().page > 1);
  readonly canNext = computed(() => {
    const p = this.pagination();
    return p.totalPages > 0 && p.page < p.totalPages;
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) {
        clearTimeout(this.searchTimer);
      }
    });

    const id = this.selectedId() || ALL_SESSIONS_ID;
    const title =
      id === ALL_SESSIONS_ID
        ? ALL_SESSIONS_TITLE
        : this.selectedTitle()?.trim() || ALL_SESSIONS_TITLE;
    this.draftId.set(id);
    this.draftTitle.set(title);
    void this.loadPage(1);
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.appliedQuery.set(value.trim());
      void this.loadPage(1);
    }, 280);
  }

  selectAll(): void {
    this.draftId.set(ALL_SESSIONS_ID);
    this.draftTitle.set(ALL_SESSIONS_TITLE);
  }

  selectSession(session: AttendanceSession): void {
    this.draftId.set(session.id);
    this.draftTitle.set(session.title);
  }

  isDraft(id: string): boolean {
    return this.draftId() === id;
  }

  prevPage(): void {
    if (!this.canPrev()) {
      return;
    }
    void this.loadPage(this.pagination().page - 1);
  }

  nextPage(): void {
    if (!this.canNext()) {
      return;
    }
    void this.loadPage(this.pagination().page + 1);
  }

  cancel(): void {
    this.closed.emit();
  }

  /** Option B: confirm only via this button. */
  useSession(): void {
    this.confirmed.emit({
      id: this.draftId(),
      title: this.draftTitle(),
    });
  }

  formatOpened(value: string): string {
    return formatSessionOpened(value);
  }

  formatLocation(name: string): string {
    return formatCampusLocationLabel(name);
  }

  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await this.sessionService.listSessionsPage({
        page,
        limit: SESSION_PICKER_PAGE_SIZE,
        q: this.appliedQuery() || undefined,
      });
      this.items.set(response.items);
      this.pagination.set(response.pagination);

      // Resolve draft title if we only knew the id from the filter.
      const draft = this.draftId();
      if (draft !== ALL_SESSIONS_ID) {
        const match = response.items.find((row) => row.id === draft);
        if (match) {
          this.draftTitle.set(match.title);
        }
      }
    } catch (error) {
      this.error.set(
        this.sessionService.mapError(
          error,
          'Could not load sessions. Try again.',
        ),
      );
      this.items.set([]);
      this.pagination.set({
        page: 1,
        limit: SESSION_PICKER_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      });
    } finally {
      this.loading.set(false);
    }
  }
}
