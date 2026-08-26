import {
  Student,
  StudentFilterState,
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

/** Pure metric builder shared with the teacher Students page. */
export function buildStudentMetrics(students: Student[]): StatCard[] {
  const total = students.length;
  const active = students.filter((student) => student.status === 'Active').length;
  const review = students.filter((student) => student.status === 'Review').length;

  return [
    {
      label: 'Total students',
      value: String(total),
      helper: 'Registered for attendance scanning',
      icon: 'students',
      tone: 'blue',
    },
    {
      label: 'Active scanners',
      value: String(active),
      helper: 'Can submit attendance this term',
      icon: 'attendance',
      tone: 'green',
    },
    { 
      label: 'Needs review',
      value: String(review),
      helper: 'Profile or attendance issues',
      icon: 'late',
      tone: 'amber',
    },
  ];
}

/** Filter options derived from the student directory. */
export function buildStudentFilters(students: Student[]): StudentFilters {
  const courses = new Set(students.map((student) => student.course).filter(Boolean));
  return {
    searchPlaceholder: 'Search student name or ID',
    statusOptions: STATUS_OPTIONS,
    courseOptions: [
      ALL_CLASSES,
      ...[...courses].map((course) => ({ value: course, label: course })),
    ],
  };
}

/** Apply the Students toolbar to the directory list. */
export function filterStudents(
  students: Student[],
  filters: StudentFilterState,
): Student[] {
  const query = filters.search.trim().toLowerCase();
  return students.filter((student) => {
    if (filters.course !== 'all' && student.course !== filters.course) {
      return false;
    }
    if (filters.status !== 'all' && student.status !== filters.status) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      student.name.toLowerCase().includes(query) ||
      student.studentId.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query)
    );
  });
}
