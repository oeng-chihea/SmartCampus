import { Component, computed, input, output } from '@angular/core';
import { ActionMenuComponent } from '../action-menu/action-menu.component';
import {
  TableAction,
  TableActionEvent,
  TableColumn,
  TablePrimaryValue,
} from './table.model';

/**
 * Shared data-table shell (location-directory look).
 * Pages pass column titles + row mappers; cell data stays page-owned.
 */
@Component({
  selector: 'app-table',
  imports: [ActionMenuComponent],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent<T = unknown> {
  /** Uppercase eyebrow above the title (e.g. "Location directory"). */
  readonly eyebrow = input.required<string>();
  /** Section heading (e.g. "Approved zones"). */
  readonly title = input.required<string>();
  /** Count line under the title (e.g. "8 locations"). */
  readonly countLabel = input.required<string>();
  /** Accessible name for the table region. */
  readonly tableAriaLabel = input.required<string>();
  /** Column headers + cell extractors for this page. */
  readonly columns = input.required<TableColumn<T>[]>();
  /** Row data for the current page (already filtered by the page). */
  readonly rows = input.required<T[]>();
  /** Property used for @for track (default `id`). */
  readonly trackKey = input<string>('id');
  /** When set, that row gets the active highlight. */
  readonly activeRowId = input<string | null>(null);
  /** When true, row click / Enter emit `rowSelect`. */
  readonly interactive = input(false);
  /** Show green Export control in the header. */
  readonly showExport = input(false);
  /**
   * Smaller cell type + single-line values (no mid-string wrap).
   * Used by sessions / location logs where stamps stay on one row.
   */
  readonly compact = input(false);
  /**
   * Roomier scan-log layout: wider gaps, two-line time, address ellipsis.
   * Used by attendance history and location visit tables.
   */
  readonly comfortable = input(false);
  /** Loading banner above / instead of body. */
  readonly loading = input(false);
  readonly loadingMessage = input('Loading…');
  readonly emptyTitle = input('No rows to show');
  readonly emptyMessage = input('Try adjusting your filters or create a new entry.');

  readonly rowSelect = output<T>();
  readonly actionClick = output<TableActionEvent<T>>();
  readonly exportClick = output<void>();

  readonly gridTemplate = computed(() =>
    this.columns()
      .map((column) => column.width ?? 'minmax(7.5rem, 1fr)')
      .join(' '),
  );

  readonly headingId = computed(
    () => `app-table-heading-${this.slugify(this.title())}`,
  );

  trackRow(row: T): string {
    const key = this.trackKey();
    const record = row as Record<string, unknown>;
    const value = record?.[key];
    return value == null ? JSON.stringify(row) : String(value);
  }

  isActive(row: T): boolean {
    const active = this.activeRowId();
    if (active == null) {
      return false;
    }
    return this.trackRow(row) === active;
  }

  cellType(column: TableColumn<T>): NonNullable<TableColumn<T>['type']> {
    return column.type ?? 'text';
  }

  /**
   * Resolved horizontal alignment for a column.
   * Badge / actions default to `end` so they sit on the trailing side of the row.
   */
  cellAlign(column: TableColumn<T>): 'start' | 'center' | 'end' {
    if (column.align) {
      return column.align;
    }
    const type = this.cellType(column);
    return type === 'badge' || type === 'actions' ? 'end' : 'start';
  }

  isStartAligned(column: TableColumn<T>): boolean {
    return this.cellAlign(column) === 'start';
  }

  isEndAligned(column: TableColumn<T>): boolean {
    return this.cellAlign(column) === 'end';
  }

  isCenterAligned(column: TableColumn<T>): boolean {
    return this.cellAlign(column) === 'center';
  }

  textValue(column: TableColumn<T>, row: T): string {
    const raw = column.value?.(row);
    if (raw == null || raw === '') {
      return '—';
    }
    return String(raw);
  }

  primaryValue(column: TableColumn<T>, row: T): TablePrimaryValue {
    return column.primary?.(row) ?? { title: this.textValue(column, row) };
  }

  badgeLabel(column: TableColumn<T>, row: T): string {
    return this.textValue(column, row);
  }

  badgeClass(column: TableColumn<T>, row: T): string {
    const variant = (column.badgeVariant?.(row) ?? this.badgeLabel(column, row))
      .toLowerCase()
      .replace(/\s+/g, '-');
    return `data-table__badge data-table__badge--${variant}`;
  }

  visibleActions(column: TableColumn<T>, row: T): TableAction[] {
    return (column.actions?.(row) ?? []).filter((action) => action.visible !== false);
  }

  onRowActivate(row: T): void {
    if (!this.interactive()) {
      return;
    }
    this.rowSelect.emit(row);
  }

  onRowKeydown(event: KeyboardEvent, row: T): void {
    if (!this.interactive()) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowSelect.emit(row);
    }
  }

  onAction(actionId: string, row: T): void {
    this.actionClick.emit({ actionId, row });
  }

  onExport(): void {
    this.exportClick.emit();
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  }
}
