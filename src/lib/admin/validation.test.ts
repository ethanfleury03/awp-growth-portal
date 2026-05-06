import { describe, expect, it } from 'vitest';
import {
  isAssignableRole,
  isCrmEntityType,
  isCrmFieldType,
  isModuleKey,
  isValidEmail,
} from '@/lib/admin/validation';

describe('admin validation', () => {
  it('validates tenant and user emails', () => {
    expect(isValidEmail('client@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('allows assignable client roles but not super_admin assignment', () => {
    expect(isAssignableRole('admin')).toBe(true);
    expect(isAssignableRole('viewer')).toBe(true);
    expect(isAssignableRole('super_admin')).toBe(false);
  });

  it('validates module keys', () => {
    expect(isModuleKey('crm')).toBe(true);
    expect(isModuleKey('definitely-not-real')).toBe(false);
  });

  it('validates CRM field and entity values', () => {
    expect(isCrmEntityType('lead')).toBe(true);
    expect(isCrmEntityType('vendor')).toBe(false);
    expect(isCrmFieldType('select')).toBe(true);
    expect(isCrmFieldType('object')).toBe(false);
  });
});
