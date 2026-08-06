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
