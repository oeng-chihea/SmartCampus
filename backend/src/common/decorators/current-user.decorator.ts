import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../constants/roles.constant';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

/**
 * Reads the authenticated user attached by AuthGuard.
 * Use only on routes protected by AuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    return request.user as AuthenticatedUser;
  },
);
