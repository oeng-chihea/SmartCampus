import { ActionMenuItem } from '../action-menu/action-menu.model';

/** Supported cell renderers for the shared data table. */
export type TableCellType = 'text' | 'primary' | 'badge' | 'actions';

/** Row action item for the shared ⋮ menu (e.g. Show QR / Close on Sessions). */
export type TableAction = ActionMenuItem;

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
  /** Plain text / badge label. */
  value?: (row: T) => string | number | null | undefined;
  /** Title + optional subtitle (primary cell). */
  primary?: (row: T) => { title: string; subtitle?: string };
  /**
   * Badge visual token (CSS class suffix).
   * Examples: `active`, `inactive`, `present`, `open`, `outside-location`.
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
