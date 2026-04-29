import type { SessionUser } from '@/lib/auth/types';
import type { ModuleKey } from '@/lib/modules/catalog';

export type CompanyBranding = {
  displayName: string;
  legalName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  portalTitle: string;
  workspaceLabel: string;
};

export type CompanyCustomField = {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive: boolean;
};

export type CompanyPipelineStage = {
  id: string;
  entityType: string;
  stageKey: string;
  label: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

export type CompanyWorkspace = {
  assigned: boolean;
  companyId: string | null;
  companyName: string | null;
  branchId: string | null;
  role: SessionUser['role'] | null;
  industry: string;
  timezone: string;
  defaultRoute: string;
  branding: CompanyBranding;
  enabledModules: ModuleKey[];
};
