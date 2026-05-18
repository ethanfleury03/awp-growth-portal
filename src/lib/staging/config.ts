type Env = Partial<Record<
  | 'APP_ENV'
  | 'NODE_ENV'
  | 'VERCEL'
  | 'VERCEL_BRANCH_URL'
  | 'VERCEL_ENV'
  | 'VERCEL_GIT_COMMIT_REF'
  | 'VERCEL_GIT_COMMIT_SHA'
  | 'VERCEL_PROJECT_PRODUCTION_URL'
  | 'VERCEL_URL'
  | 'APP_BASE_URL'
  | 'NEXT_PUBLIC_APP_BASE_URL'
  | 'NEXT_PUBLIC_APP_URL'
  | 'STAGING_HEALTH_URL'
  | 'STAGING_PORTAL_URL',
  string
>>;

function normalizeHttpUrl(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getAppEnvironment(env: Env = process.env): string {
  return env.APP_ENV?.trim() || env.VERCEL_ENV?.trim() || env.NODE_ENV || 'development';
}

export function isStagingEnvironment(env: Env = process.env): boolean {
  return getAppEnvironment(env).toLowerCase() === 'staging';
}

export function isProductionEnvironment(env: Env = process.env): boolean {
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv === 'production') return true;
  return getAppEnvironment(env).toLowerCase() === 'production';
}

export function getCurrentDeploymentUrl(env: Env = process.env): string | null {
  return normalizeHttpUrl(
    env.NEXT_PUBLIC_APP_URL ||
      env.NEXT_PUBLIC_APP_BASE_URL ||
      env.APP_BASE_URL ||
      env.VERCEL_PROJECT_PRODUCTION_URL ||
      env.VERCEL_URL,
  );
}

export function getConfiguredStagingPortalUrl(env: Env = process.env): string | null {
  return normalizeHttpUrl(
    env.STAGING_PORTAL_URL ||
      (isStagingEnvironment(env)
        ? env.NEXT_PUBLIC_APP_URL ||
          env.NEXT_PUBLIC_APP_BASE_URL ||
          env.APP_BASE_URL ||
          env.VERCEL_BRANCH_URL ||
          env.VERCEL_URL
        : ''),
  );
}

export function getStagingHealthUrl(env: Env = process.env): string | null {
  const explicit = normalizeHttpUrl(env.STAGING_HEALTH_URL);
  if (explicit) return explicit;
  const stagingUrl = getConfiguredStagingPortalUrl(env);
  return stagingUrl ? `${stagingUrl}/api/health` : null;
}

export function getStagingBuildMetadata(env: Env = process.env) {
  return {
    appEnv: getAppEnvironment(env),
    vercelEnv: env.VERCEL_ENV || null,
    branch: env.VERCEL_GIT_COMMIT_REF || null,
    commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    deploymentUrl: getCurrentDeploymentUrl(env),
    onVercel: env.VERCEL === '1',
  };
}
