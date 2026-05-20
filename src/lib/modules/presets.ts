import type { ModuleKey } from '@/lib/modules/catalog';

export type IndustryPresetKey = 'generic' | 'hvac' | 'plumbing' | 'roofing' | 'agency' | 'custom';

export type IndustryPreset = {
  key: IndustryPresetKey;
  label: string;
  modules: ModuleKey[];
  leadStages: { key: string; label: string; color: string }[];
  jobStages: { key: string; label: string; color: string }[];
  customFields: {
    entityType: 'lead' | 'customer' | 'job' | 'estimate';
    fieldKey: string;
    label: string;
    fieldType: string;
    required?: boolean;
    options?: string[];
  }[];
};

const serviceModules: ModuleKey[] = [
  'dashboard',
  'crm',
  'customers',
  'tickets',
  'estimates',
  'invoices',
  'marketing',
  'outreach',
  'ai-assistant',
  'reports',
  'settings',
];

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    key: 'generic',
    label: 'Generic Service Business',
    modules: serviceModules,
    leadStages: [
      { key: 'new', label: 'New', color: '#2563eb' },
      { key: 'contacted', label: 'Contacted', color: '#7c3aed' },
      { key: 'quoted', label: 'Quoted', color: '#f59e0b' },
      { key: 'won', label: 'Won', color: '#059669' },
    ],
    jobStages: [
      { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
      { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
      { key: 'complete', label: 'Complete', color: '#059669' },
    ],
    customFields: [],
  },
  {
    key: 'hvac',
    label: 'HVAC',
    modules: [...serviceModules, 'dispatch', 'calendar', 'receptionist'],
    leadStages: [
      { key: 'new', label: 'New Request', color: '#2563eb' },
      { key: 'triaged', label: 'Triaged', color: '#7c3aed' },
      { key: 'estimate_sent', label: 'Estimate Sent', color: '#f59e0b' },
      { key: 'scheduled', label: 'Scheduled', color: '#059669' },
    ],
    jobStages: [
      { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
      { key: 'tech_assigned', label: 'Tech Assigned', color: '#7c3aed' },
      { key: 'complete', label: 'Complete', color: '#059669' },
    ],
    customFields: [
      { entityType: 'lead', fieldKey: 'system_type', label: 'System type', fieldType: 'select', options: ['AC', 'Furnace', 'Heat pump', 'Boiler'] },
      { entityType: 'lead', fieldKey: 'urgency', label: 'Urgency', fieldType: 'select', options: ['Emergency', 'This week', 'Flexible'] },
    ],
  },
  {
    key: 'plumbing',
    label: 'Plumbing',
    modules: [...serviceModules, 'dispatch', 'calendar', 'receptionist'],
    leadStages: [
      { key: 'new', label: 'New Call', color: '#2563eb' },
      { key: 'emergency', label: 'Emergency', color: '#dc2626' },
      { key: 'quoted', label: 'Quoted', color: '#f59e0b' },
      { key: 'scheduled', label: 'Scheduled', color: '#059669' },
    ],
    jobStages: [
      { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
      { key: 'dispatched', label: 'Dispatched', color: '#7c3aed' },
      { key: 'complete', label: 'Complete', color: '#059669' },
    ],
    customFields: [
      { entityType: 'lead', fieldKey: 'issue_type', label: 'Issue type', fieldType: 'select', options: ['Leak', 'Drain', 'Water heater', 'Fixture', 'Other'] },
      { entityType: 'lead', fieldKey: 'shutoff_needed', label: 'Water shutoff needed', fieldType: 'boolean' },
    ],
  },
  {
    key: 'roofing',
    label: 'Roofing',
    modules: [...serviceModules, 'calendar'],
    leadStages: [
      { key: 'new', label: 'New Lead', color: '#2563eb' },
      { key: 'inspection', label: 'Inspection', color: '#7c3aed' },
      { key: 'proposal', label: 'Proposal', color: '#f59e0b' },
      { key: 'won', label: 'Won', color: '#059669' },
    ],
    jobStages: [
      { key: 'scheduled', label: 'Scheduled', color: '#2563eb' },
      { key: 'materials', label: 'Materials Ordered', color: '#f59e0b' },
      { key: 'complete', label: 'Complete', color: '#059669' },
    ],
    customFields: [
      { entityType: 'lead', fieldKey: 'roof_type', label: 'Roof type', fieldType: 'select', options: ['Asphalt', 'Metal', 'Flat', 'Unknown'] },
    ],
  },
  {
    key: 'agency',
    label: 'Agency',
    modules: ['dashboard', 'crm', 'customers', 'tickets', 'marketing', 'outreach', 'ai-assistant', 'reports', 'settings'],
    leadStages: [
      { key: 'new', label: 'New', color: '#2563eb' },
      { key: 'discovery', label: 'Discovery', color: '#7c3aed' },
      { key: 'proposal', label: 'Proposal', color: '#f59e0b' },
      { key: 'won', label: 'Won', color: '#059669' },
    ],
    jobStages: [
      { key: 'planned', label: 'Planned', color: '#2563eb' },
      { key: 'active', label: 'Active', color: '#7c3aed' },
      { key: 'complete', label: 'Complete', color: '#059669' },
    ],
    customFields: [
      { entityType: 'lead', fieldKey: 'budget', label: 'Budget', fieldType: 'text' },
      { entityType: 'lead', fieldKey: 'service_interest', label: 'Service interest', fieldType: 'text' },
    ],
  },
  {
    key: 'custom',
    label: 'Custom',
    modules: ['dashboard', 'crm', 'customers', 'tickets', 'settings'],
    leadStages: [],
    jobStages: [],
    customFields: [],
  },
];

export function getIndustryPreset(key: string | null | undefined): IndustryPreset {
  return INDUSTRY_PRESETS.find((p) => p.key === key) ?? INDUSTRY_PRESETS[0];
}
