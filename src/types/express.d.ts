import type { AuthenticatedUser } from '../modules/auth/auth.types';
import type { AuthorizationAccessSummary } from '../modules/authorization/authorization.types';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedUser;
      authorizationAccess?: AuthorizationAccessSummary;
    }
  }
}

export {};
