import type { UserRole } from '@/lib/auth/types';
import { isStagingEnvironment } from '@/lib/staging/config';

export const STAGING_SUPER_ADMIN_ONLY_REASON = 'staging_super_admin_only';

export function canAccessStaging(
  role: UserRole | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !isStagingEnvironment(env) || Boolean(role);
}
