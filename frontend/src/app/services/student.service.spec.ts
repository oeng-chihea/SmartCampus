import { describe, expect, it } from 'vitest';
import {
  buildStudentFilters,
  buildStudentMetrics,
} from '../core/utils/student-stats.util';
import { Student } from '../models/student.model';

const sample: Student[] = [
  {
    studentId: 'SC-1001',
    name: 'Chihea',
    email: 'chihea@smartcampus.edu',
    course: 'SE401',
    year: 'Year 1',
    attendanceRate: 100,
    status: 'Active',
    loginEnabled: true,
    hasAccount: true,
  },
  {
    studentId: 'SC-1002',
    name: 'Another Student',
    email: 'another@smartcampus.edu',
    course: 'SE302',
    year: 'Year 2',
    attendanceRate: 50,
    status: 'Review',
    loginEnabled: false,
    hasAccount: false,
  },
];

describe('student-stats util', () => {
  it('builds the three summary metrics from the student list', () => {
    const metrics = buildStudentMetrics(sample);

    expect(metrics).toHaveLength(3);
    expect(metrics[0].label).toBe('Total students');
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('1');
    expect(metrics[2].value).toBe('1');
  });

  it('derives filters with unique courses plus status options', () => {
    const filters = buildStudentFilters(sample);

    expect(filters.statusOptions.map((option) => option.value)).toEqual([
      'all',
      'Active',
      'Review',
      'Inactive',
    ]);
    expect(filters.courseOptions).toEqual([
      { value: 'all', label: 'All classes' },
      { value: 'SE401', label: 'SE401' },
      { value: 'SE302', label: 'SE302' },
    ]);
  });

  it('returns only the "All classes" option when there are no students', () => {
    const filters = buildStudentFilters([]);
    expect(filters.courseOptions).toEqual([{ value: 'all', label: 'All classes' }]);
  });
});
