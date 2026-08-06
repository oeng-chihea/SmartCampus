import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more application roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
