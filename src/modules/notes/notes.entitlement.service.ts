import { Injectable } from '@nestjs/common';

@Injectable()
export class NotesEntitlementService {
  async canAccessPremiumNote(_userId: string, _noteId: string) {
    // Payment-backed entitlements arrive in B11. Until then, premium note
    // access is denied unless the caller is handled by a higher-level bypass
    // such as admin access.
    return false;
  }
}
