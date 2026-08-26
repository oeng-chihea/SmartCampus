import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  join(__dirname, 'student-filter.component.html'),
  'utf8',
);
const component = readFileSync(
  join(__dirname, 'student-filter.component.ts'),
  'utf8',
);

describe('StudentFilter template', () => {
  it('reuses the shared select dropdown for Class and Status', () => {
    expect(template).toContain('>Class<');
    expect(template).toContain('>Status<');
    expect(template).toContain('app-select-dropdown');
    expect(template).toContain('filters().courseOptions');
    expect(template).toContain('filters().statusOptions');
    expect(template).toContain('onCourseChange');
    expect(template).toContain('onStatusChange');
    expect(template).not.toContain('<select');
    expect(component).toContain('SelectDropdownComponent');
  });
});
