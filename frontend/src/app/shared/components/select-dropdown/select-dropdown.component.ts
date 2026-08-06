import {
  Component,
  ElementRef,
  HostListener,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectOption } from './select-dropdown.model';

/**
 * Animated custom select for forms (replaces native OS dropdown UI).
 * Supports ngModel via ControlValueAccessor.
 * Panel is absolutely positioned under the trigger so it always aligns
 * with the field (including inside transformed modals).
 */
@Component({
  selector: 'app-select-dropdown',
  standalone: true,
  templateUrl: './select-dropdown.component.html',
  styleUrl: './select-dropdown.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectDropdownComponent),
      multi: true,
    },
  ],
  host: {
    class: 'app-select-dropdown-host',
    '[class.app-select-dropdown-host--open]': 'open()',
    '[class.app-select-dropdown-host--invalid]': 'invalid()',
    '[class.app-select-dropdown-host--disabled]': 'isDisabled()',
  },
})
export class SelectDropdownComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly instanceId = `select-dd-${Math.random().toString(36).slice(2, 9)}`;

  /** Options shown in the panel. */
  readonly options = input<SelectOption[]>([]);

  /** Empty-state label when nothing is selected. */
  readonly placeholder = input('Select an option');

  /** Marks the trigger with danger styling. */
  readonly invalid = input(false);

  /** Optional id for aria-describedby / label association. */
  readonly inputId = input<string | null>(null);

  /** Emitted when the value changes (in addition to CVA). */
  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly value = signal('');
  readonly isDisabled = signal(false);
  readonly activeIndex = signal(-1);
  /** Open panel above the field when there is little space below. */
  readonly openUpward = signal(false);

  listId(): string {
    return `${this.instanceId}-list`;
  }

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  selectedLabel(): string {
    const current = this.value();
    if (!current) {
      return '';
    }
    return this.options().find((option) => option.value === current)?.label ?? '';
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) {
      this.open.set(false);
    }
  }

  toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    if (this.open()) {
      this.close();
      return;
    }
    this.openPanel();
  }

  openPanel(): void {
    if (this.isDisabled()) {
      return;
    }
    this.updatePlacement();
    this.open.set(true);
    const selected = this.options().findIndex((option) => option.value === this.value());
    this.activeIndex.set(selected >= 0 ? selected : 0);
  }

  close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.activeIndex.set(-1);
    this.openUpward.set(false);
    this.onTouched();
  }

  selectOption(option: SelectOption, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (option.disabled || this.isDisabled()) {
      return;
    }
    this.value.set(option.value);
    this.onChange(option.value);
    this.valueChange.emit(option.value);
    this.close();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.open()) {
          this.openPanel();
        } else if (event.key === 'Enter' || event.key === ' ') {
          this.selectActive();
        } else if (event.key === 'ArrowDown') {
          this.moveActive(1);
        } else {
          this.moveActive(-1);
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        break;
      default:
        break;
    }
  }

  onListKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectActive();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Home':
        event.preventDefault();
        this.setActiveToFirstEnabled();
        break;
      case 'End':
        event.preventDefault();
        this.setActiveToLastEnabled();
        break;
      default:
        break;
    }
  }

  isSelected(option: SelectOption): boolean {
    return option.value === this.value() && option.value !== '';
  }

  setActive(index: number): void {
    this.activeIndex.set(index);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) {
      this.updatePlacement();
    }
  }

  /** Prefer opening below the field; flip above when near the viewport bottom. */
  private updatePlacement(): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    this.openUpward.set(spaceBelow < 200 && spaceAbove > spaceBelow);
  }

  private selectActive(): void {
    const options = this.options();
    const index = this.activeIndex();
    if (index < 0 || index >= options.length) {
      return;
    }
    const option = options[index];
    if (!option.disabled) {
      this.selectOption(option);
    }
  }

  private moveActive(delta: number): void {
    const options = this.options();
    if (options.length === 0) {
      return;
    }
    let index = this.activeIndex();
    for (let step = 0; step < options.length; step += 1) {
      index = (index + delta + options.length) % options.length;
      if (!options[index]?.disabled) {
        this.activeIndex.set(index);
        return;
      }
    }
  }

  private setActiveToFirstEnabled(): void {
    const index = this.options().findIndex((option) => !option.disabled);
    this.activeIndex.set(index);
  }

  private setActiveToLastEnabled(): void {
    const options = this.options();
    for (let i = options.length - 1; i >= 0; i -= 1) {
      if (!options[i].disabled) {
        this.activeIndex.set(i);
        return;
      }
    }
    this.activeIndex.set(-1);
  }
}
