/**
 * DEPRECATED cookie-based session layer. The app authenticates exclusively
 * through Clerk. These helpers are retained only as no-ops so old callers
 * do not crash during the transition; they will be deleted in a follow-up
 * commit once every import site has been removed.
 */

import type { SessionUser } from '@/lib/auth/types';
import { SESSION_COOKIE } from '@/lib/auth/constants';
export { SESSION_COOKIE } from '@/lib/auth/constants';

/**
 * @deprecated Sessions are managed by Clerk. This throws to prevent writing
 * shadow sessions to the database.
 */
export async function createSession(_userId: string): Promise<string> {
  throw new Error(
    'createSession is deprecated. Authentication is handled by Clerk; use @clerk/nextjs instead.',
  );
}

/**
 * @deprecated Use `getPortalUser()` from `@/lib/auth/portal-user`, which reads
 * the Clerk session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  return null;
}

/**
 * @deprecated Use Clerk's sign-out flow. This is a no-op.
 */
export async function deleteSession(): Promise<void> {
  return;
}
