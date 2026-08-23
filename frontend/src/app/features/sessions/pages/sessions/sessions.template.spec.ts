import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'sessions.component.html'), 'utf8');

describe('Sessions template', () => {
  it('hides Due on edit and keeps it on create', () => {
    expect(template).toContain('@if (!state.isEditDialog())');
    expect(template).toContain('id="session-due-label"');
    expect(template).toContain('name="dueDate"');
    expect(template).toContain('name="dueTime"');
    expect(template).toContain('Session title');
    expect(template).toContain('Campus location');
  });
});
