import { UserStatus, UserType } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  siteId: string;
  sessionId: string;
  userType: UserType;
  tokenType: 'access';
};

export type RefreshTokenPayload = {
  sub: string;
  siteId: string;
  sessionId: string;
  familyId: string;
  userType: UserType;
  tokenType: 'refresh';
};

export type NoteViewTokenPayload = {
  sub: string;
  siteId: string;
  noteId: string;
  noteViewSessionId: string;
  accessMode: 'FULL' | 'PREVIEW';
  tokenType: 'note_view';
};

export type RequestSessionMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuthenticatedUser = {
  userId: string;
  siteId: string;
  sessionId: string;
  email: string;
  fullName: string;
  userType: UserType;
  status: UserStatus;
};

export type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  sessionId: string;
};
