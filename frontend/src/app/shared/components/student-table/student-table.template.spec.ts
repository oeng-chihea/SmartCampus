import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(join(__dirname, 'student-table.component.html'), 'utf8');
const styles = readFileSync(join(__dirname, 'student-table.component.scss'), 'utf8');

describe('StudentTable template', () => {
  it('keeps header and student rows inside one aligned table grid', () => {
    expect(template).toContain('class="student-table__grid"');
    expect(template).toMatch(
      /<div class="student-table__grid">[\s\S]*student-table__row student-table__row--head[\s\S]*@for/,
    );
    expect(template).toContain('data-label="Student"');
    expect(template).toContain('data-label="Status"');
    expect(styles).not.toContain('min-width: 820px');
  });
});
