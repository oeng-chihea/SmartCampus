import { SelectOption } from '../shared/components/select-dropdown/select-dropdown.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

export interface Student {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  attendanceRate: number;
  status: 'Active' | 'Review' | 'Inactive';
  /** When false, student cannot sign in (FR-01 access control). */
  loginEnabled: boolean;
  /** True when a login account exists for this student (users row linked). */
  hasAccount?: boolean;
}

/** Payload for the teacher “Add student account” form (creates profile + login). */
export interface CreateStudentRequest {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  password: string;
}

/** UI-only option lists the Students toolbar renders. */
export interface StudentFilters {
  searchPlaceholder: string;
  statusOptions: SelectOption[];
  courseOptions: SelectOption[];
}

/** Current filter form state applied to the directory. */
export interface StudentFilterState {
  search: string;
  course: string;
  status: string;
}

export interface StudentManagement {
  title: string;
  subtitle: string;
  metrics: StatCard[];
  filters: StudentFilters;
  students: Student[];
}
