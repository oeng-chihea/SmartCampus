import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(join(__dirname, 'modal-dialog.component.scss'), 'utf8');
const template = readFileSync(join(__dirname, 'modal-dialog.component.html'), 'utf8');
const source = readFileSync(join(__dirname, 'modal-dialog.component.ts'), 'utf8');

describe('Modal dialog detail styling', () => {
  it('keeps the default header and footer dividers for record detail dialogs', () => {
    expect(styles).toContain('border-bottom: 2px solid var(--modal-dialog-rule);');
    expect(styles).toContain('border-top: 2px solid var(--modal-dialog-rule);');
    expect(styles).not.toContain(
      'Record detail dialogs use spacing instead of internal header/footer rules.',
    );
    expect(styles).not.toContain('.modal-dialog:has(.record-detail) .modal-dialog__header');
    expect(styles).not.toContain('.modal-dialog:has(.record-detail) .modal-dialog__footer');
  });

  it('supports a disabled close control and traps focus inside the dialog', () => {
    expect(template).toContain('#closeButton');
    expect(template).toContain('[disabled]="closeDisabled()"');
    expect(source).toContain('onTab');
    expect(source).toContain('previouslyFocusedElement');
  });
});
