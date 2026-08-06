export type StatCardIcon =
  | 'students'
  | 'attendance'
  | 'locations'
  | 'sessions'
  | 'reports'
  | 'present'
  | 'late';

export interface StatCard {
  label: string;
  value: string;
  helper: string;
  icon: StatCardIcon;
  tone: 'blue' | 'green' | 'amber' | 'violet';
}
