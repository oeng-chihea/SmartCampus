/** Single item in the shared row action (⋮) menu. */
export interface ActionMenuItem {
  id: string;
  label: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  /** Defaults to true when omitted. */
  visible?: boolean;
}
