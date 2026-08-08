import { Student, StudentFilters } from '../../models/student.model';
import { StatCard } from '../../shared/components/stat-card/stat-card.model';

/** Pure metric builder shared with the admin Students page. */
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
    statusOptions: ['All statuses', 'Active', 'Review', 'Inactive'],
    courseOptions: ['All classes', ...courses],
  };
}
