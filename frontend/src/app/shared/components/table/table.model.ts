import { ActionMenuItem } from '../action-menu/action-menu.model';

/** Supported cell renderers for the shared data table. */
export type TableCellType = 'text' | 'primary' | 'badge' | 'actions';

/** Row action item for the shared ⋮ menu (e.g. Show QR / Close on Sessions). */
export type TableAction = ActionMenuItem;

/** Optional notice chip beside a primary-cell subtitle (GPS accuracy, etc.). */
export interface TablePrimaryChip {
  label: string;
  /** Native tooltip; defaults to the label when omitted. */
  title?: string;
}

/** Title + optional subtitle / chip for a primary cell. */
export interface TablePrimaryValue {
  title: string;
  subtitle?: string;
  chip?: TablePrimaryChip;
  /** Native tooltip on the title (full address when the title is truncated). */
  titleAttr?: string;
  /** Ellipsis a long title so it cannot push neighboring columns. */
  truncate?: boolean;
}

/** Column definition — headers and cell extractors are owned by each page. */
export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  type?: TableCellType;
  /** CSS grid track for this column (desktop layout). */
  width?: string;
  /**
   * Horizontal alignment for header + cell content.
   * Badge and actions columns default to `end` when omitted.
   */
  align?: 'start' | 'center' | 'end';
  /** Extra class on the header and every body cell (spacing hooks). */
  cellClass?: string;
  /** Plain text / badge label. */
  value?: (row: T) => string | number | null | undefined;
  /** Title + optional subtitle / chip (primary cell). */
  primary?: (row: T) => TablePrimaryValue;
  /**
   * Badge visual token (CSS class suffix).
   * Examples: `active`, `inactive`, `present`, `inside`, `open`,
   * `outside-location`, `outside`, `distance`, `empty`.
   */
  badgeVariant?: (row: T) => string;
  /** Action items for the shared ⋮ menu in an actions column. */
  actions?: (row: T) => TableAction[];
}

/** Emitted when a row action label is clicked. */
export interface TableActionEvent<T = unknown> {
  actionId: string;
  row: T;
}
