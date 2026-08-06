import { User, UserRole } from './user.model';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface DemoAccount {
  email: string;
  password: string;
  role: UserRole;
  label: string;
}
