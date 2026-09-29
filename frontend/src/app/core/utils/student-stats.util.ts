import {
  Student,
  StudentDirectorySummary,
  StudentFilters,
} from '../../models/student.model';
import { SelectOption } from '../../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../../shared/components/stat-card/stat-card.model';

const ALL_CLASSES: SelectOption = { value: 'all', label: 'All classes' };
const ALL_STATUSES: SelectOption = { value: 'all', label: 'All statuses' };

const STATUS_OPTIONS: SelectOption[] = [
  ALL_STATUSES,
  { value: 'Active', label: 'Active' },
  { value: 'Review', label: 'Review' },
  { value: 'Inactive', label: 'Inactive' },
];

/** Build directory-wide cards from either a full list or API summary counts. */
export function buildStudentMetrics(students: Student[]): StatCard[];
export function buildStudentMetrics(summary: StudentDirectorySummary): StatCard[];
export function buildStudentMetrics(
  source: Student[] | StudentDirectorySummary,
): StatCard[] {
  const summary = Array.isArray(source)
    ? {
        totalStudents: source.length,
        activeScanners: source.filter((student) => student.status === 'Active').length,
        needsReview: source.filter((student) => student.status === 'Review').length,
      }
    : (source as StudentDirectorySummary);

  return [
    {
      label: 'Total students',
      value: String(summary.totalStudents),
      helper: 'Registered for attendance scanning',
      icon: 'students',
      tone: 'blue',
    },
    {
      label: 'Active scanners',
      value: String(summary.activeScanners),
      helper: 'Can submit attendance this term',
      icon: 'attendance',
      tone: 'green',
    },
    {
      label: 'Needs review',
      value: String(summary.needsReview),
      helper: 'Profile or attendance issues',
      icon: 'late',
      tone: 'amber',
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
