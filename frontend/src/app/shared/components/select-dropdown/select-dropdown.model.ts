/** Option row for `app-select-dropdown`. */
export interface SelectOption {
  value: string;
  label: string;
  /** Optional secondary line under the main label. */
  hint?: string;
  disabled?: boolean;
}
