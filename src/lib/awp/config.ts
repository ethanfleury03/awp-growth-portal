export const awpBusinessProfile = {
  businessName: 'Adirondack White Pine Cabins',
  shortName: 'AWP Cabins',
  productName: 'WNY Automation Portal',
  website: 'https://www.adirondackwhitepinecabins.com/',
  address: '18 Plumb Creek Lane, Saranac Lake, New York 12983',
  phone: '+1 (518) 891-1444',
  email: 'awpcabins@gmail.com',
  businessType: 'Custom cabin and modular home builder',
  primaryRegion: 'Adirondack region / Upstate New York',
  coreOffer: 'Custom four-season cabins and homes',
  differentiators: [
    'Custom design',
    'Four-season construction',
    'Built indoors',
    'White pine craftsmanship',
    'NYS Modular Certified positioning',
    'Permitting guidance',
    'Delivered to customer site',
  ],
  aiContext: [
    'Custom cabins',
    'Four-season use',
    'Adirondack region',
    'NYS Modular Certified positioning',
    'Indoor construction',
    'White pine materials',
    'Permitting help',
    'Site prep',
    'Slab/foundation requirements',
    'ADU, guest house, rental, and second-home use cases',
    'Premium craftsmanship',
    'Saranac Lake location',
  ],
  aiGuardrail:
    'Do not invent specific pricing, warranties, financing terms, or delivery promises unless they are stored in the CRM or explicitly entered by the user.',
} as const;

export const awpPipelineStages = [
  { value: 'new_lead', label: 'New Lead', color: '#2563eb' },
  { value: 'contacted', label: 'Contacted', color: '#0ea5e9' },
  { value: 'qualified', label: 'Qualified', color: '#16a34a' },
  { value: 'planning_call_scheduled', label: 'Planning Call Scheduled', color: '#7c3aed' },
  { value: 'site_details_needed', label: 'Site Details Needed', color: '#d97706' },
  { value: 'design_layout_discussion', label: 'Design / Layout Discussion', color: '#db2777' },
  { value: 'estimate_needed', label: 'Estimate Needed', color: '#ea580c' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: '#ca8a04' },
  { value: 'follow_up_needed', label: 'Follow-Up Needed', color: '#dc2626' },
  { value: 'won', label: 'Won', color: '#15803d' },
  { value: 'lost', label: 'Lost', color: '#64748b' },
  { value: 'nurture', label: 'Nurture', color: '#475569' },
] as const;

export const awpEstimateDefaults = {
  prefix: 'AWP',
  terms:
    'Proposal details are valid for the period shown. Final pricing, schedule, delivery, site prep, utilities, permits, taxes, and customer responsibilities must be confirmed in writing before work begins.',
  footer:
    'Thank you for considering Adirondack White Pine Cabins. We will confirm site readiness, design details, and scope before any final commitment.',
} as const;

export const awpEstimateCatalogDefaults = [
  {
    name: 'Cabin planning consultation',
    description: 'Initial buyer consultation covering intended use, location, timeline, budget range, and next steps.',
    unitPriceCents: 0,
  },
  {
    name: 'Site readiness review',
    description: 'Review of land ownership, access, utilities, slab/foundation readiness, delivery path, and open site questions.',
    unitPriceCents: 0,
  },
  {
    name: 'Design and layout discussion',
    description: 'Discussion of cabin size, layout goals, four-season needs, materials preferences, and required follow-up.',
    unitPriceCents: 0,
  },
  {
    name: 'Permit and delivery coordination',
    description: 'Coordination notes for permitting guidance, delivery requirements, customer responsibilities, and local constraints.',
    unitPriceCents: 0,
  },
  {
    name: 'Custom cabin proposal placeholder',
    description: 'Placeholder for final scoped cabin proposal. Replace with verified pricing before sending to a customer.',
    unitPriceCents: 0,
  },
  {
    name: 'Referral partner follow-up',
    description: 'Non-billable follow-up item for realtor, campground, contractor, or partner referral opportunities.',
    unitPriceCents: 0,
  },
] as const;

export const awpReusableArchitectureDefaults = [
  {
    key: 'business-profile-options-prompts',
    title: 'Business profile, options, prompts',
    source: 'src/lib/awp/config.ts',
    purpose: 'One place for AWP labels, pipeline stages, lead options, module fields, defaults, and prompts.',
    body:
      'Use this artifact as the source of truth for company labels, core offer, service region, differentiators, lead qualification options, and prompt guardrails. If a claim is not represented here or in another verified artifact, avoid inventing it.',
    aiUse:
      'Prefer this artifact when deciding how to describe the company, its offer, its region, and the allowed tone of generated content.',
    owner: 'Portal configuration',
    tags: ['business profile', 'prompts', 'guardrails'],
    confidence: 'Verified',
  },
  {
    key: 'demo-bootstrap',
    title: 'Demo bootstrap',
    source: 'src/lib/awp/seed.ts',
    purpose: 'Seeds AWP demo leads, stages, campaigns, lists, assets, SEO tasks, projects, prompts, and architecture artifacts without duplicates.',
    body:
      'Demo seed data should be treated as scaffolding. Real client-entered CRM, estimate, marketing, and knowledge records should take priority over demo data whenever there is a conflict.',
    aiUse:
      'Use this artifact to identify which records are sample defaults and avoid treating seeded examples as guaranteed real customer facts.',
    owner: 'Portal configuration',
    tags: ['seed data', 'demo data', 'defaults'],
    confidence: 'Verified',
  },
  {
    key: 'growth-modules',
    title: 'Growth modules',
    source: 'growth_records table',
    purpose: 'Generic record storage for campaigns, lists, assets, SEO, projects, reports, and AI templates.',
    body:
      'Growth records are flexible client workspace artifacts. The AI assistant can reference them for marketing work, outreach planning, SEO tasks, reports, and campaign status, but should propose drafts instead of mutating data directly.',
    aiUse:
      'Use this artifact when deciding where marketing, outreach, SEO, report, and template records belong.',
    owner: 'Growth workspace',
    tags: ['growth records', 'marketing', 'outreach', 'seo'],
    confidence: 'Verified',
  },
  {
    key: 'lead-qualification-fields',
    title: 'Lead qualification fields',
    source: 'leads.lead_context_json',
    purpose: 'Stores cabin-specific qualification data while preserving the reusable lead model.',
    body:
      'Cabin lead qualification should live in structured lead context where possible: lead type, land ownership, site access, utilities, intended use, budget, timeline, interest level, notes, owner, and AI summary.',
    aiUse:
      'Use this artifact when qualifying leads, summarizing opportunities, and deciding what follow-up questions are missing.',
    owner: 'CRM workspace',
    tags: ['crm', 'lead qualification', 'structured context'],
    confidence: 'Verified',
  },
] as const;

export const awpLeadTypeOptions = [
  'Homeowner',
  'Landowner',
  'Realtor',
  'Land Broker',
  'Campground Owner',
  'Resort / Hospitality Business',
  'Airbnb / STR Investor',
  'Excavation Contractor',
  'Septic / Well Contractor',
  'Builder / Contractor',
  'Architect / Designer',
  'Referral Partner',
  'Other',
] as const;

export const awpLeadSourceOptions = [
  'Website Form',
  'Phone Call',
  'Email',
  'Facebook',
  'Instagram',
  'Google Search',
  'Referral',
  'Realtor Outreach',
  'Campground Outreach',
  'Resort Outreach',
  'Contractor Partner',
  'Trade Show',
  'Manual Entry',
  'Imported List',
  'Other',
] as const;

export const awpIntendedUseOptions = [
  'Primary Residence',
  'Second Home',
  'Vacation Cabin',
  'Guest House',
  'ADU',
  'Rental / Airbnb',
  'Campground Unit',
  'Resort Expansion',
  'Hunting / Recreation Cabin',
  'Office / Studio',
  'Unknown',
] as const;

export const awpYesNoUnknownOptions = ['Unknown', 'Yes', 'No'] as const;

export const awpCampaignStatuses = ['Idea', 'Drafting', 'Ready', 'Active', 'Paused', 'Completed'] as const;
export const awpCampaignAudiences = [
  'Realtors',
  'Land Brokers',
  'Campgrounds',
  'Resorts',
  'STR Investors',
  'Homeowners',
  'Past Customers',
  'Contractors',
  'Local Partners',
  'Website Visitors',
  'Other',
] as const;

export const awpListStatuses = ['Building', 'Ready', 'Active Outreach', 'Paused', 'Complete'] as const;
export const awpOutreachStatuses = [
  'Not Contacted',
  'Contacted',
  'Opened',
  'Replied',
  'Interested',
  'Not Interested',
  'Follow-Up Later',
  'Converted to Lead',
] as const;

export const awpAssetTypes = [
  'Brochure',
  'Buyer Guide',
  'Case Study',
  'Website Copy',
  'Email Template',
  'Facebook Post',
  'Ad Creative',
  'Photo',
  'Video',
  'Testimonial',
  'FAQ Answer',
  'Proposal Template',
  'Site Prep Checklist',
  'Pricing Guide',
  'Other',
] as const;

export const awpAssetStatuses = ['Idea', 'Drafting', 'Needs Review', 'Approved', 'Published', 'Archived'] as const;

export const awpSeoTaskTypes = [
  'Page Creation',
  'Page Rewrite',
  'Metadata Update',
  'URL Slug Fix',
  'Internal Linking',
  'Image Alt Text',
  'Local SEO',
  'Blog Post',
  'Case Study',
  'Technical Fix',
  'Conversion Improvement',
  'Form Improvement',
] as const;

export const awpSeoPriorities = ['High', 'Medium', 'Low'] as const;
export const awpSeoStatuses = ['Idea', 'Planned', 'In Progress', 'Needs Review', 'Complete'] as const;

export const awpProjectTypes = [
  'Custom Cabin',
  'Four-Season Home',
  'Guest House',
  'ADU',
  'Rental Cabin',
  'Vacation Home',
  'Campground Unit',
  'Resort Cabin',
  'Other',
] as const;

export const awpProjectMarketingStatuses = [
  'Needs Info',
  'Drafting Case Study',
  'Needs Photos',
  'Ready for Review',
  'Published',
] as const;

export type GrowthRecordType =
  | 'campaign'
  | 'lead_list'
  | 'asset'
  | 'seo_task'
  | 'project'
  | 'ai_prompt_template';

export type FieldType = 'text' | 'textarea' | 'select' | 'number' | 'date' | 'url';

export type GrowthFieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  options?: readonly string[];
  placeholder?: string;
};

export type GrowthModuleConfig = {
  type: GrowthRecordType;
  navLabel: string;
  title: string;
  eyebrow: string;
  description: string;
  addLabel: string;
  statusOptions: readonly string[];
  fields: GrowthFieldConfig[];
  summaryFields: string[];
};

export const awpGrowthModules = {
  campaigns: {
    type: 'campaign',
    navLabel: 'Outreach Campaigns',
    title: 'Outreach Campaigns',
    eyebrow: 'Partner Outreach / Demand Generation',
    description: 'Track email, referral, ad, and buyer-guide campaigns for cabin buyers and partners.',
    addLabel: 'New campaign',
    statusOptions: awpCampaignStatuses,
    fields: [
      { key: 'audience', label: 'Audience', type: 'select', options: awpCampaignAudiences },
      { key: 'goal', label: 'Goal', type: 'textarea' },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'numberOfContacts', label: 'Number of contacts', type: 'number' },
      { key: 'emailsSent', label: 'Emails sent', type: 'number' },
      { key: 'opens', label: 'Opens', type: 'number' },
      { key: 'clicks', label: 'Clicks', type: 'number' },
      { key: 'replies', label: 'Replies', type: 'number' },
      { key: 'leadsGenerated', label: 'Leads generated', type: 'number' },
      { key: 'relatedAssets', label: 'Related assets', type: 'text' },
      { key: 'nextAction', label: 'Next action', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summaryFields: ['audience', 'goal', 'nextAction'],
  },
  leadLists: {
    type: 'lead_list',
    navLabel: 'Lead Lists',
    title: 'Lead Lists',
    eyebrow: 'Prospecting Sources',
    description: 'Organize AWP prospect lists without duplicating the core leads database.',
    addLabel: 'New list',
    statusOptions: awpListStatuses,
    fields: [
      { key: 'audienceType', label: 'Audience type', type: 'select', options: awpCampaignAudiences },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'numberOfContacts', label: 'Number of contacts', type: 'number' },
      { key: 'owner', label: 'Owner', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'dateCreated', label: 'Date created', type: 'date' },
      { key: 'lastUpdated', label: 'Last updated', type: 'date' },
    ],
    summaryFields: ['audienceType', 'source', 'owner'],
  },
  assets: {
    type: 'asset',
    navLabel: 'Marketing Assets',
    title: 'Marketing Assets',
    eyebrow: 'Sales Enablement',
    description: 'Keep brochures, buyer guides, email templates, case studies, and SEO copy organized.',
    addLabel: 'New asset',
    statusOptions: awpAssetStatuses,
    fields: [
      { key: 'assetType', label: 'Type', type: 'select', options: awpAssetTypes },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'fileUrl', label: 'File URL or storage reference', type: 'url' },
      { key: 'relatedCampaign', label: 'Related campaign', type: 'text' },
      { key: 'relatedRecord', label: 'Related lead/list/project', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    summaryFields: ['assetType', 'description', 'relatedCampaign'],
  },
  seoTasks: {
    type: 'seo_task',
    navLabel: 'Website Growth',
    title: 'Website Growth Tracker',
    eyebrow: 'Website / SEO',
    description: 'Prioritize website fixes, new pages, case studies, and conversion improvements.',
    addLabel: 'New SEO task',
    statusOptions: awpSeoStatuses,
    fields: [
      { key: 'taskType', label: 'Type', type: 'select', options: awpSeoTaskTypes },
      { key: 'priority', label: 'Priority', type: 'select', options: awpSeoPriorities },
      { key: 'targetKeyword', label: 'Target keyword', type: 'text' },
      { key: 'pageUrl', label: 'Page URL', type: 'url' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'assignedTo', label: 'Assigned to', type: 'text' },
      { key: 'dueDate', label: 'Due date', type: 'date' },
      { key: 'completedDate', label: 'Completed date', type: 'date' },
    ],
    summaryFields: ['taskType', 'priority', 'targetKeyword'],
  },
  projects: {
    type: 'project',
    navLabel: 'Cabin Projects',
    title: 'Project Case Studies',
    eyebrow: 'Projects / Case Studies',
    description: 'Capture past cabin projects and turn them into website, email, and social proof assets.',
    addLabel: 'New project',
    statusOptions: awpProjectMarketingStatuses,
    fields: [
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'projectType', label: 'Project type', type: 'select', options: awpProjectTypes },
      { key: 'intendedUse', label: 'Intended use', type: 'select', options: awpIntendedUseOptions },
      { key: 'buildDescription', label: 'Build description', type: 'textarea' },
      { key: 'customerGoals', label: 'Customer goals', type: 'textarea' },
      { key: 'designHighlights', label: 'Design highlights', type: 'textarea' },
      { key: 'constructionHighlights', label: 'Construction highlights', type: 'textarea' },
      { key: 'sitePrepNotes', label: 'Site prep notes', type: 'textarea' },
      { key: 'timeline', label: 'Timeline', type: 'text' },
      { key: 'materialsFeatures', label: 'Materials/features', type: 'textarea' },
      { key: 'photos', label: 'Photos', type: 'textarea', placeholder: 'Photo URLs or notes' },
      { key: 'virtualTourUrl', label: 'Virtual tour URL', type: 'url' },
      { key: 'testimonial', label: 'Testimonial', type: 'textarea' },
      { key: 'relatedAssets', label: 'Related assets', type: 'text' },
    ],
    summaryFields: ['location', 'projectType', 'intendedUse'],
  },
} satisfies Record<string, GrowthModuleConfig>;

export const awpDefaultGrowthRecords: Record<GrowthRecordType, {
  sourceKey: string;
  title: string;
  status: string;
  owner?: string;
  payload: Record<string, unknown>;
}[]> = {
  campaign: [
    {
      sourceKey: 'campaign-realtor-partner',
      title: 'Adirondack Realtor Partner Outreach',
      status: 'Active',
      owner: 'AWP Sales',
      payload: {
        audience: 'Realtors',
        goal: 'Build referral relationships with agents helping buyers purchase Adirondack land.',
        numberOfContacts: 40,
        emailsSent: 18,
        opens: 9,
        clicks: 2,
        replies: 3,
        leadsGenerated: 1,
        relatedAssets: 'Realtor Partner Email',
        nextAction: 'Send second-wave outreach to Lake Placid and Saranac Lake agents.',
        notes: 'Demo data. Replace with verified campaign metrics.',
      },
    },
    {
      sourceKey: 'campaign-campground-expansion',
      title: 'Campground Cabin Expansion Outreach',
      status: 'Drafting',
      owner: 'AWP Sales',
      payload: {
        audience: 'Campgrounds',
        goal: 'Start conversations with campground owners about premium four-season rental cabins.',
        numberOfContacts: 25,
        emailsSent: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        leadsGenerated: 0,
        relatedAssets: 'Campground Expansion Email',
        nextAction: 'Finalize email copy and build campground list.',
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'campaign-buyer-guide',
      title: 'Cabin Buyer Guide Lead Magnet',
      status: 'Ready',
      owner: 'Marketing',
      payload: {
        audience: 'Homeowners',
        goal: 'Capture website leads researching cabin budgets, site prep, and delivery.',
        numberOfContacts: 0,
        emailsSent: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        leadsGenerated: 0,
        relatedAssets: 'Adirondack Cabin Buyer Guide',
        nextAction: 'Add buyer guide form to high-intent website pages.',
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'campaign-site-prep-partners',
      title: 'Site Prep Partner Referral Campaign',
      status: 'Idea',
      owner: 'AWP Sales',
      payload: {
        audience: 'Contractors',
        goal: 'Create referral relationships with excavation, slab, septic, and well contractors.',
        numberOfContacts: 30,
        emailsSent: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        leadsGenerated: 0,
        relatedAssets: 'Site Prep Checklist',
        nextAction: 'Build list of contractors within priority service areas.',
        notes: 'Demo data.',
      },
    },
  ],
  lead_list: [
    {
      sourceKey: 'list-adirondack-realtors',
      title: 'Adirondack Realtors',
      status: 'Active Outreach',
      owner: 'AWP Sales',
      payload: {
        audienceType: 'Realtors',
        source: 'Manual research / local brokerages',
        numberOfContacts: 40,
        notes: 'Demo list. Add verified brokerage contacts before sending.',
        contacts: [
          {
            name: 'Demo Realtor Contact',
            businessName: 'Sample Adirondack Realty',
            email: 'demo.realtor@example.com',
            phone: '',
            website: '',
            location: 'Lake Placid, NY',
            contactType: 'Realtor',
            outreachStatus: 'Not Contacted',
            notes: 'Demo contact only.',
          },
        ],
      },
    },
    {
      sourceKey: 'list-land-brokers',
      title: 'Upstate NY Land Brokers',
      status: 'Building',
      owner: 'AWP Sales',
      payload: {
        audienceType: 'Land Brokers',
        source: 'Land listing sites and brokerage websites',
        numberOfContacts: 20,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-campgrounds',
      title: 'Adirondack Campgrounds',
      status: 'Building',
      owner: 'Marketing',
      payload: {
        audienceType: 'Campgrounds',
        source: 'Google Maps / tourism directories',
        numberOfContacts: 25,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-hospitality',
      title: 'Lake Placid / Saranac Lake Hospitality Businesses',
      status: 'Ready',
      owner: 'Marketing',
      payload: {
        audienceType: 'Resorts',
        source: 'Local hospitality research',
        numberOfContacts: 18,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-site-prep-contractors',
      title: 'Excavation & Site Prep Contractors',
      status: 'Building',
      owner: 'AWP Sales',
      payload: {
        audienceType: 'Contractors',
        source: 'Local contractor directories',
        numberOfContacts: 30,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-septic-well',
      title: 'Septic and Well Contractors',
      status: 'Building',
      owner: 'AWP Sales',
      payload: {
        audienceType: 'Contractors',
        source: 'Manual research',
        numberOfContacts: 22,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-str-managers',
      title: 'Airbnb / STR Property Managers',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        audienceType: 'STR Investors',
        source: 'Local STR and property management research',
        numberOfContacts: 12,
        notes: 'Demo data.',
      },
    },
    {
      sourceKey: 'list-modular-adu',
      title: 'Modular Home / ADU Prospects',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        audienceType: 'Homeowners',
        source: 'Website and paid search audience',
        numberOfContacts: 0,
        notes: 'Demo data.',
      },
    },
  ],
  asset: [
    {
      sourceKey: 'asset-main-brochure',
      title: 'AWP Main Brochure',
      status: 'Needs Review',
      owner: 'Marketing',
      payload: {
        assetType: 'Brochure',
        description: 'Core AWP overview for buyers and referral partners.',
        relatedCampaign: 'Realtor Partner Outreach',
        notes: 'Demo asset. Attach final file when approved.',
      },
    },
    {
      sourceKey: 'asset-buyer-guide',
      title: 'Adirondack Cabin Buyer Guide',
      status: 'Drafting',
      owner: 'Marketing',
      payload: {
        assetType: 'Buyer Guide',
        description: 'Lead magnet explaining land, site prep, design, permitting, and delivery considerations.',
        relatedCampaign: 'Cabin Buyer Guide Lead Magnet',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-site-prep-checklist',
      title: 'Cabin Site Prep Checklist',
      status: 'Drafting',
      owner: 'Marketing',
      payload: {
        assetType: 'Site Prep Checklist',
        description: 'Checklist for slab/foundation, access, utilities, and site readiness.',
        relatedCampaign: 'Site Prep Partner Referral Campaign',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-realtor-email',
      title: 'Realtor Partner Email',
      status: 'Approved',
      owner: 'AWP Sales',
      payload: {
        assetType: 'Email Template',
        description: 'Short outreach email for realtors and land brokers.',
        relatedCampaign: 'Adirondack Realtor Partner Outreach',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-campground-email',
      title: 'Campground Expansion Email',
      status: 'Drafting',
      owner: 'AWP Sales',
      payload: {
        assetType: 'Email Template',
        description: 'Outreach email for campground owners considering premium rental cabins.',
        relatedCampaign: 'Campground Cabin Expansion Outreach',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-resort-email',
      title: 'Resort Expansion Email',
      status: 'Idea',
      owner: 'AWP Sales',
      payload: {
        assetType: 'Email Template',
        description: 'Outreach email for resort and hospitality expansion conversations.',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-four-season-seo',
      title: 'Four-Season Cabin SEO Page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        assetType: 'Website Copy',
        description: 'SEO page for four-season cabin buyers in the Adirondacks.',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-adu-seo',
      title: 'ADU Cabin SEO Page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        assetType: 'Website Copy',
        description: 'SEO page for ADU and guest cabin use cases.',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-case-study-template',
      title: 'Project Case Study Template',
      status: 'Drafting',
      owner: 'Marketing',
      payload: {
        assetType: 'Case Study',
        description: 'Reusable structure for project pages and social/email repurposing.',
        notes: 'Demo asset.',
      },
    },
    {
      sourceKey: 'asset-monthly-report-template',
      title: 'Monthly Growth Report Template',
      status: 'Approved',
      owner: 'Marketing',
      payload: {
        assetType: 'Proposal Template',
        description: 'Monthly reporting structure for leads, campaigns, website progress, assets, and next actions.',
        notes: 'Demo asset.',
      },
    },
  ],
  seo_task: [
    {
      sourceKey: 'seo-rename-blank-construction',
      title: 'Rename /blank to /construction or equivalent descriptive slug',
      status: 'Planned',
      owner: 'Marketing',
      payload: {
        taskType: 'URL Slug Fix',
        priority: 'High',
        targetKeyword: 'Adirondack cabin construction',
        pageUrl: '/blank',
        notes: 'Demo task from initial website audit.',
      },
    },
    {
      sourceKey: 'seo-rename-blank-gallery',
      title: 'Rename /blank-1 to /gallery or equivalent descriptive slug',
      status: 'Planned',
      owner: 'Marketing',
      payload: {
        taskType: 'URL Slug Fix',
        priority: 'High',
        targetKeyword: 'Adirondack cabin gallery',
        pageUrl: '/blank-1',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-pricing-cost-drivers',
      title: 'Create a Pricing / Cost Drivers page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Page Creation',
        priority: 'High',
        targetKeyword: 'custom cabin cost Adirondacks',
        pageUrl: '/pricing',
        notes: 'Avoid inventing pricing; explain cost drivers and invite a planning conversation.',
      },
    },
    {
      sourceKey: 'seo-site-prep',
      title: 'Create a Cabin Site Prep page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Page Creation',
        priority: 'High',
        targetKeyword: 'cabin site prep Adirondacks',
        pageUrl: '/site-prep',
        notes: 'Cover access, slab/foundation, utilities, septic/well, and permitting coordination.',
      },
    },
    {
      sourceKey: 'seo-adu-guest-cabin',
      title: 'Create an ADU / Guest Cabin page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Page Creation',
        priority: 'Medium',
        targetKeyword: 'ADU cabin New York',
        pageUrl: '/adu-guest-cabins',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-four-season-cabins',
      title: 'Create Four-Season Cabin page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Page Creation',
        priority: 'High',
        targetKeyword: 'four season cabins Adirondacks',
        pageUrl: '/four-season-cabins',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-case-study-pages',
      title: 'Create project case study pages for Tupper Lake, Lake Flower, Brant Lake, Saranac Lake, and Lake Placid',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Case Study',
        priority: 'Medium',
        targetKeyword: 'Adirondack cabin projects',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-lead-forms',
      title: 'Add stronger on-domain lead capture forms',
      status: 'Planned',
      owner: 'Marketing',
      payload: {
        taskType: 'Form Improvement',
        priority: 'High',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-buyer-guide',
      title: 'Add downloadable buyer guide',
      status: 'Planned',
      owner: 'Marketing',
      payload: {
        taskType: 'Conversion Improvement',
        priority: 'High',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-alt-captions',
      title: 'Add photo captions and alt text',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Image Alt Text',
        priority: 'Medium',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-service-areas',
      title: 'Create service-area pages for Adirondack locations',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Local SEO',
        priority: 'Medium',
        targetKeyword: 'custom cabins Adirondacks',
        notes: 'Demo task.',
      },
    },
    {
      sourceKey: 'seo-trust-page',
      title: 'Create updated team/founder/trust page',
      status: 'Idea',
      owner: 'Marketing',
      payload: {
        taskType: 'Page Rewrite',
        priority: 'Medium',
        notes: 'Demo task.',
      },
    },
  ],
  project: ['Tupper Lake', 'Lake Flower', 'Brant Lake', 'Saranac Lake', 'Lake Placid'].map((location) => ({
    sourceKey: `project-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: location,
    status: 'Needs Info',
    owner: 'Marketing',
    payload: {
      location: `${location}, NY`,
      projectType: 'Custom Cabin',
      intendedUse: 'Vacation Cabin',
      buildDescription: 'Demo project placeholder. Replace with verified project notes, photos, and customer-approved details.',
      customerGoals: 'Capture customer goals before publishing.',
      designHighlights: 'Add verified design highlights.',
      constructionHighlights: 'Add verified construction details.',
      sitePrepNotes: 'Add slab, access, utility, or permitting notes if approved.',
      marketingStatus: 'Needs Info',
      relatedAssets: 'Project Case Study Template',
    },
  })),
  ai_prompt_template: [
    {
      sourceKey: 'prompt-lead-summary',
      title: 'Lead Summary Prompt',
      status: 'Active',
      payload: {
        category: 'Lead follow-up',
        prompt:
          'Given this lead detail, summarize who they are, what they want, their timeline, their likely value, and the next best action.',
      },
    },
    {
      sourceKey: 'prompt-lead-scoring',
      title: 'Lead Scoring Prompt',
      status: 'Active',
      payload: {
        category: 'Lead qualification',
        prompt:
          'Score this lead from 1-100 based on project fit, budget, timeline, land ownership, location, and seriousness. Explain the score briefly.',
      },
    },
    {
      sourceKey: 'prompt-follow-up-email',
      title: 'Follow-Up Email Prompt',
      status: 'Active',
      payload: {
        category: 'Email',
        prompt:
          'Write a professional follow-up email for this AWP cabin lead. Keep it helpful, clear, and not pushy.',
      },
    },
    {
      sourceKey: 'prompt-realtor-outreach',
      title: 'Realtor Outreach Prompt',
      status: 'Active',
      payload: {
        category: 'Partner outreach',
        prompt:
          'Write a short outreach email to a realtor or land broker explaining how AWP Cabins can help their clients who are buying land and want a custom cabin.',
      },
    },
    {
      sourceKey: 'prompt-campground-outreach',
      title: 'Campground Outreach Prompt',
      status: 'Active',
      payload: {
        category: 'Partner outreach',
        prompt:
          'Write an outreach email to a campground owner explaining how four-season cabins could create premium rental opportunities.',
      },
    },
    {
      sourceKey: 'prompt-resort-outreach',
      title: 'Resort Outreach Prompt',
      status: 'Active',
      payload: {
        category: 'Partner outreach',
        prompt:
          'Write an outreach email to a resort or hospitality business about adding custom cabins for guest lodging.',
      },
    },
    {
      sourceKey: 'prompt-case-study',
      title: 'Case Study Prompt',
      status: 'Active',
      payload: {
        category: 'Content',
        prompt: 'Turn the following project notes into a polished case study for AWP Cabins.',
      },
    },
    {
      sourceKey: 'prompt-seo-page',
      title: 'SEO Page Prompt',
      status: 'Active',
      payload: {
        category: 'SEO',
        prompt:
          'Create an SEO page outline for the following topic, using AWP positioning around custom four-season cabins, white-pine craftsmanship, indoor construction, permitting help, and delivery.',
      },
    },
    {
      sourceKey: 'prompt-monthly-report',
      title: 'Monthly Report Prompt',
      status: 'Active',
      payload: {
        category: 'Reporting',
        prompt:
          'Summarize this month leads, campaigns, completed tasks, wins, bottlenecks, and recommended next actions.',
      },
    },
  ],
};

export function pipelineLabel(value?: string | null) {
  const stage = awpPipelineStages.find((item) => item.value === value);
  return stage?.label || sourceFromSlug(value) || 'New Lead';
}

export function sourceToSlug(source?: string | null) {
  return (source || 'Manual Entry').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function sourceFromSlug(source?: string | null) {
  if (!source) return 'Manual Entry';
  const normalized = source.replace(/_/g, ' ');
  return awpLeadSourceOptions.find((option) => option.toLowerCase() === normalized.toLowerCase()) || normalized;
}
