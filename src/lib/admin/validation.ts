import type { UserRole } from '@/lib/auth/types';
import { MODULE_CATALOG, type ModuleKey } from '@/lib/modules/catalog';

export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = ['admin', 'dispatcher', 'staff', 'tech', 'viewer'];
export const CRM_ENTITY_TYPES = ['lead', 'customer', 'job', 'estimate'] as const;
export const CRM_FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'boolean', 'email', 'phone', 'url'] as const;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isAssignableRole(value: string): value is UserRole {
  return ADMIN_ASSIGNABLE_ROLES.includes(value as UserRole);
}

export function isModuleKey(value: string): value is ModuleKey {
  return MODULE_CATALOG.some((mod) => mod.key === value);
}

export function isCrmEntityType(value: string): value is (typeof CRM_ENTITY_TYPES)[number] {
  return CRM_ENTITY_TYPES.includes(value as (typeof CRM_ENTITY_TYPES)[number]);
}

export function isCrmFieldType(value: string): value is (typeof CRM_FIELD_TYPES)[number] {
  return CRM_FIELD_TYPES.includes(value as (typeof CRM_FIELD_TYPES)[number]);
}
