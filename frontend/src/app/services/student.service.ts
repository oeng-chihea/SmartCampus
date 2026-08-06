import studentsMock from '../../assets/mock-data/students.json';
import { Student, StudentFilters, StudentManagement } from '../models/student.model';
import { StatCard } from '../shared/components/stat-card/stat-card.model';

interface StudentsMockFile {
  title: string;
  subtitle: string;
  filters: StudentFilters;
  students: Student[];
}

const mock = studentsMock as StudentsMockFile;

export class StudentService {
  getStudentManagement(): StudentManagement {
    const students = mock.students;

    return {
      title: mock.title,
      subtitle: mock.subtitle,
      metrics: this.buildMetrics(students),
      filters: mock.filters,
      students,
    };
  }

  private buildMetrics(students: Student[]): StatCard[] {
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
}
