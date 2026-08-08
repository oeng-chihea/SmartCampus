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

/** Payload for the admin “Add student account” form (creates profile + login). */
export interface CreateStudentRequest {
  studentId: string;
  name: string;
  email: string;
  course: string;
  year: string;
  password: string;
}

export interface StudentFilters {
  searchPlaceholder: string;
  statusOptions: string[];
  courseOptions: string[];
}

export interface StudentManagement {
  title: string;
  subtitle: string;
  metrics: StatCard[];
  filters: StudentFilters;
  students: Student[];
}
