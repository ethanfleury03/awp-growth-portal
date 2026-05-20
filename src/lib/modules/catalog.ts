import type { UserRole } from '@/lib/auth/types';
import { isStagingEnvironment } from '@/lib/staging/config';

export type ModuleKey =
  | 'dashboard'
  | 'leads'
  | 'crm'
  | 'customers'
  | 'tickets'
  | 'jobs'
  | 'estimates'
  | 'invoices'
  | 'dispatch'
  | 'calendar'
  | 'receptionist'
  | 'marketing'
  | 'outreach'
  | 'ai-assistant'
  | 'billing'
  | 'reports'
  | 'assets'
  | 'settings';

export type ModuleDefinition = {
  key: ModuleKey;
  flagKey: string;
  label: string;
  route: string;
  description: string;
  defaultEnabled: boolean;
  requiredRole: UserRole;
  dependencies?: ModuleKey[];
  stagingOnly?: boolean;
};

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    key: 'dashboard',
    flagKey: 'module.dashboard',
    label: 'Dashboard',
    route: '/app',
    description: 'Primary client dashboard and workspace overview.',
    defaultEnabled: true,
    requiredRole: 'viewer',
  },
  {
    key: 'crm',
    flagKey: 'module.crm',
    label: 'CRM',
    route: '/crm',
    description: 'Cabin buyer pipeline, opportunity details, and service catalog.',
    defaultEnabled: true,
    requiredRole: 'viewer',
  },
  {
    key: 'customers',
    flagKey: 'module.customers',
    label: 'Customers',
    route: '/customers',
    description: 'Customer records and customer history.',
    defaultEnabled: true,
    requiredRole: 'staff',
  },
  {
    key: 'tickets',
    flagKey: 'module.tickets',
    label: 'Tickets',
    route: '/tickets',
    description: 'Shared task board for admin-created requests and client progress conversations.',
    defaultEnabled: true,
    requiredRole: 'viewer',
  },
  {
    key: 'estimates',
    flagKey: 'module.estimates',
    label: 'Estimates',
    route: '/estimates',
    description: 'Estimate creation, approval, and delivery.',
    defaultEnabled: true,
    requiredRole: 'staff',
    dependencies: ['customers'],
  },
  {
    key: 'invoices',
    flagKey: 'module.invoices',
    label: 'Invoices',
    route: '/invoices',
    description: 'Invoice management and checkout links.',
    defaultEnabled: true,
    requiredRole: 'admin',
    dependencies: ['customers'],
  },
  {
    key: 'dispatch',
    flagKey: 'module.dispatch',
    label: 'Dispatch',
    route: '/dispatch',
    description: 'Dispatch board and field operations.',
    defaultEnabled: false,
    requiredRole: 'dispatcher',
    dependencies: ['customers'],
  },
  {
    key: 'calendar',
    flagKey: 'module.calendar',
    label: 'Calendar',
    route: '/calendar',
    description: 'Calendar view for scheduled work.',
    defaultEnabled: false,
    requiredRole: 'staff',
    dependencies: ['customers'],
  },
  {
    key: 'receptionist',
    flagKey: 'module.receptionist',
    label: 'AI Receptionist',
    route: '/receptionist',
    description: 'Call intake, Retell flows, and call review.',
    defaultEnabled: false,
    requiredRole: 'admin',
    dependencies: ['crm'],
  },
  {
    key: 'marketing',
    flagKey: 'module.marketing',
    label: 'Marketing',
    route: '/marketing',
    description: 'Marketing performance and website growth tools.',
    defaultEnabled: true,
    requiredRole: 'staff',
    stagingOnly: true,
  },
  {
    key: 'outreach',
    flagKey: 'module.outreach',
    label: 'Outreach',
    route: '/outreach',
    description: 'Outbound campaigns and follow-up workflows.',
    defaultEnabled: true,
    requiredRole: 'staff',
    dependencies: ['crm'],
    stagingOnly: true,
  },
  {
    key: 'ai-assistant',
    flagKey: 'module.ai-assistant',
    label: 'AI Growth Assistant',
    route: '/ai-assistant',
    description: 'AI assistant for account and growth operations.',
    defaultEnabled: true,
    requiredRole: 'staff',
  },
  {
    key: 'billing',
    flagKey: 'module.billing',
    label: 'Billing',
    route: '/billing',
    description: 'Subscription, payment method, invoices, and AI usage billing.',
    defaultEnabled: true,
    requiredRole: 'admin',
  },
  {
    key: 'reports',
    flagKey: 'module.reports',
    label: 'Reports',
    route: '/reports',
    description: 'Reporting and performance summaries.',
    defaultEnabled: true,
    requiredRole: 'admin',
  },
  {
    key: 'assets',
    flagKey: 'module.assets',
    label: 'Assets',
    route: '/assets',
    description: 'Client assets, files, and working materials.',
    defaultEnabled: false,
    requiredRole: 'staff',
  },
  {
    key: 'settings',
    flagKey: 'module.settings',
    label: 'Settings',
    route: '/settings',
    description: 'Company and account settings.',
    defaultEnabled: true,
    requiredRole: 'staff',
  },
];

export const MODULE_BY_KEY = new Map(MODULE_CATALOG.map((m) => [m.key, m]));
export const MODULE_BY_ROUTE = [...MODULE_CATALOG]
  .sort((a, b) => b.route.length - a.route.length)
  .map((m) => ({ route: m.route, key: m.key }));

export function moduleForPath(pathname: string): ModuleKey | null {
  const match = MODULE_BY_ROUTE.find(
    (m) => pathname === m.route || pathname.startsWith(`${m.route}/`),
  );
  return match?.key ?? null;
}

export function moduleFlagKey(key: ModuleKey): string {
  return MODULE_BY_KEY.get(key)?.flagKey ?? `module.${key}`;
}

export function isModuleAvailableInEnvironment(
  module: ModuleDefinition,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !module.stagingOnly || isStagingEnvironment(env);
}

export function filterModuleKeysForEnvironment(
  keys: Iterable<ModuleKey>,
  env: NodeJS.ProcessEnv = process.env,
): ModuleKey[] {
  const availableKeys = new Set(
    MODULE_CATALOG.filter((module) => isModuleAvailableInEnvironment(module, env)).map((module) => module.key),
  );
  return [...keys].filter((key) => availableKeys.has(key));
}

export function expandModuleDependencies(keys: Iterable<ModuleKey>): ModuleKey[] {
  const enabled = new Set(keys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of [...enabled]) {
      const mod = MODULE_BY_KEY.get(key);
      for (const dep of mod?.dependencies ?? []) {
        if (!enabled.has(dep)) {
          enabled.add(dep);
          changed = true;
        }
      }
    }
  }
  return [...enabled];
}
