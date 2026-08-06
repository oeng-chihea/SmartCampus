/** Supported cell renderers for the shared data table. */
export type TableCellType = 'text' | 'primary' | 'badge' | 'actions';

/** Row action button (e.g. Show QR / Close on Sessions). */
export interface TableAction {
  id: string;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  /** Defaults to true when omitted. */
  visible?: boolean;
}

/** Column definition — headers and cell extractors are owned by each page. */
export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  type?: TableCellType;
  /** CSS grid track for this column (desktop layout). */
  width?: string;
  /** Align badge/actions cells. */
  align?: 'start' | 'end';
  /** Plain text / badge label. */
  value?: (row: T) => string | number | null | undefined;
  /** Title + optional subtitle (primary cell). */
  primary?: (row: T) => { title: string; subtitle?: string };
  /**
   * Badge visual token (CSS class suffix).
   * Examples: `active`, `inactive`, `present`, `open`, `outside-location`.
   */
  badgeVariant?: (row: T) => string;
  /** Action buttons for an actions column. */
  actions?: (row: T) => TableAction[];
}

/** Emitted when a row action label is clicked. */
export interface TableActionEvent<T = unknown> {
  actionId: string;
  row: T;
}
