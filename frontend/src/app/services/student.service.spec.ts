import { describe, expect, it } from 'vitest';
import { StudentService } from './student.service';

describe('StudentService', () => {
  it('loads student management data from students mock JSON', () => {
    const service = new StudentService();
    const page = service.getStudentManagement();

    expect(page.title).toBe('Students');
    expect(page.metrics).toHaveLength(3);
    expect(page.students.length).toBeGreaterThan(0);
    expect(page.filters.statusOptions).toContain('Active');
    expect(page.students.every((student) => Boolean(student.studentId))).toBe(true);
    expect(page.metrics[0].value).toBe(String(page.students.length));
  });
});
