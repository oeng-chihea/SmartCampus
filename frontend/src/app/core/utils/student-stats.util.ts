import { Student, StudentFilters } from '../../models/student.model';
import { SelectOption } from '../../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../../shared/components/stat-card/stat-card.model';

const ALL_CLASSES: SelectOption = { value: 'all', label: 'All classes' };
const ALL_STATUSES: SelectOption = { value: 'all', label: 'All statuses' };

const STATUS_OPTIONS: SelectOption[] = [
  ALL_STATUSES,
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export function buildStudentMetrics(students: Student[]): StatCard[] {
  const activeScanners = students.filter((student) => student.status === 'Active').length;

  return [
    {
      label: 'Total students',
      value: String(students.length),
      helper: 'Registered for attendance scanning',
      icon: 'students',
      tone: 'blue',
    },
    {
      label: 'Active scanners',
      value: String(activeScanners),
      helper: 'Can submit attendance this term',
      icon: 'attendance',
      tone: 'green',
    },
  ];
}

/** Build filter options from the full course list or a legacy student list. */
export function buildStudentFilters(students: Student[]): StudentFilters;
export function buildStudentFilters(courses: string[]): StudentFilters;
export function buildStudentFilters(
  source: Student[] | string[],
): StudentFilters {
  const courses = new Set(
    source
      .map((item) => (typeof item === 'string' ? item : item.course))
      .filter(Boolean),
  );
  return {
    searchPlaceholder: 'Search student name, ID, or email',
    statusOptions: STATUS_OPTIONS,
    courseOptions: [
      ALL_CLASSES,
      ...[...courses].map((course) => ({ value: course, label: course })),
    ],
  };
}
