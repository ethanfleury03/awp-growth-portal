import { sql } from '@/lib/db';
import {
  awpBusinessProfile,
  awpDefaultGrowthRecords,
  awpPipelineStages,
  sourceToSlug,
  type GrowthRecordType,
} from '@/lib/awp/config';

type SampleLead = {
  key: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  issue: string;
  description: string;
  location: string;
  source: string;
  status: string;
  priority: number;
  aiScore: number;
  estimatedValueCents: number;
  nextFollowUpDays: number;
  context: Record<string, unknown>;
};

const sampleLeads: SampleLead[] = [
  {
    key: 'john-miller-lake-placid',
    name: 'John Miller',
    email: 'john.miller.demo@example.com',
    phone: '(518) 555-0101',
    issue: 'Second home cabin near Lake Placid',
    description:
      'Demo lead interested in a four-season second home near Lake Placid. Replace with real inquiry details before outreach.',
    location: 'Lake Placid, NY',
    source: 'Website Form',
    status: 'new_lead',
    priority: 2,
    aiScore: 78,
    estimatedValueCents: 32500000,
    nextFollowUpDays: 2,
    context: {
      leadType: 'Homeowner',
      ownsLand: 'Yes',
      hasSiteAccess: 'Unknown',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Second Home',
      estimatedBudget: '$300k-$400k',
      timeline: '6-12 months',
      cabinInterestLevel: 'High',
      notes: 'Demo data. Confirm land, access, utilities, and desired layout.',
      assignedOwner: 'AWP Sales',
      aiSummary:
        'Likely high-fit buyer researching a second home in a priority Adirondack location. Next step is a planning call focused on site readiness and layout goals.',
    },
  },
  {
    key: 'sarah-thompson-realtor',
    name: 'Sarah Thompson',
    email: 'sarah.thompson.demo@example.com',
    phone: '(518) 555-0102',
    company: 'Demo Adirondack Realty',
    issue: 'Realtor with clients buying Adirondack land',
    description:
      'Demo partner lead. Realtor wants a reliable cabin-builder resource for buyers evaluating rural parcels.',
    location: 'Saranac Lake, NY',
    source: 'Realtor Outreach',
    status: 'contacted',
    priority: 3,
    aiScore: 70,
    estimatedValueCents: 0,
    nextFollowUpDays: 5,
    context: {
      leadType: 'Realtor',
      ownsLand: 'Unknown',
      hasSiteAccess: 'Unknown',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Unknown',
      estimatedBudget: 'Referral partner',
      timeline: 'Ongoing',
      cabinInterestLevel: 'Medium',
      notes: 'Demo data. Send partner one-pager and buyer guide.',
      assignedOwner: 'AWP Sales',
      aiSummary:
        'Potential referral partner who can introduce land buyers before they select a builder. Next step is partner education and lightweight follow-up.',
    },
  },
  {
    key: 'pine-ridge-campground',
    name: 'Pine Ridge Campground',
    email: 'pine.ridge.demo@example.com',
    phone: '(518) 555-0103',
    company: 'Pine Ridge Campground',
    issue: 'Campground rental cabin expansion',
    description:
      'Demo lead for a campground interested in adding premium rental cabins for shoulder-season stays.',
    location: 'Tupper Lake, NY',
    source: 'Campground Outreach',
    status: 'qualified',
    priority: 2,
    aiScore: 82,
    estimatedValueCents: 50000000,
    nextFollowUpDays: 3,
    context: {
      leadType: 'Campground Owner',
      ownsLand: 'Yes',
      hasSiteAccess: 'Yes',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Campground Unit',
      estimatedBudget: 'Multi-unit project',
      timeline: 'Next season',
      cabinInterestLevel: 'High',
      notes: 'Demo data. Ask about number of units, utility access, delivery path, and permitting constraints.',
      assignedOwner: 'AWP Sales',
      aiSummary:
        'Strong B2B fit with potential multi-unit value. Next step is a planning call around unit count, site layout, and utility readiness.',
    },
  },
  {
    key: 'north-country-excavation',
    name: 'North Country Excavation',
    email: 'north.country.excavation.demo@example.com',
    phone: '(518) 555-0104',
    company: 'North Country Excavation',
    issue: 'Site-prep referral partner',
    description:
      'Demo partner lead for excavation, access, and slab/foundation coordination referrals.',
    location: 'North Country, NY',
    source: 'Contractor Partner',
    status: 'nurture',
    priority: 4,
    aiScore: 62,
    estimatedValueCents: 0,
    nextFollowUpDays: 14,
    context: {
      leadType: 'Excavation Contractor',
      ownsLand: 'Unknown',
      hasSiteAccess: 'Unknown',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Unknown',
      estimatedBudget: 'Referral partner',
      timeline: 'Ongoing',
      cabinInterestLevel: 'Medium',
      notes: 'Demo data. Explore mutual referral process and site prep checklist.',
      assignedOwner: 'AWP Sales',
      aiSummary:
        'Potential site-prep partner who can make buyer handoffs smoother. Keep in nurture and establish referral expectations.',
    },
  },
  {
    key: 'michael-reynolds-str',
    name: 'Michael Reynolds',
    email: 'michael.reynolds.demo@example.com',
    phone: '(518) 555-0105',
    issue: 'STR investor exploring cabin rental ROI',
    description:
      'Demo investor lead comparing cabin rental concepts and site requirements before buying land.',
    location: 'Brant Lake, NY',
    source: 'Google Search',
    status: 'planning_call_scheduled',
    priority: 2,
    aiScore: 74,
    estimatedValueCents: 27500000,
    nextFollowUpDays: 1,
    context: {
      leadType: 'Airbnb / STR Investor',
      ownsLand: 'No',
      hasSiteAccess: 'Unknown',
      utilitiesAvailable: 'Unknown',
      intendedUse: 'Rental / Airbnb',
      estimatedBudget: '$250k-$350k',
      timeline: '3-9 months',
      cabinInterestLevel: 'High',
      notes: 'Demo data. Avoid ROI promises; focus on site, design, and process considerations.',
      assignedOwner: 'AWP Sales',
      aiSummary:
        'Investor is serious but still evaluating land and economics. Next step is call prep around constraints, not guaranteed returns.',
    },
  },
];

const seedPromises = new Map<string, Promise<void>>();

async function ensureAwpCompanyProfile(companyId: string) {
  await sql`
    UPDATE companies
    SET
      name = ${awpBusinessProfile.businessName},
      email = ${awpBusinessProfile.email},
      phone = ${awpBusinessProfile.phone},
      address = ${awpBusinessProfile.address},
      updated_at = datetime('now')
    WHERE id = ${companyId}
      AND (name = 'Demo Plumbing Co.' OR email = 'demo@plumberos.com')
  `;
}

async function ensureAwpPipeline(companyId: string) {
  for (const [index, stage] of awpPipelineStages.entries()) {
    const position = index + 1;
    const existing = await sql`
      SELECT id FROM buckets
      WHERE company_id = ${companyId} AND position = ${position}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE buckets
        SET title = ${stage.label}, color = ${stage.color}, updated_at = datetime('now')
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO buckets (company_id, title, color, position)
        VALUES (${companyId}, ${stage.label}, ${stage.color}, ${position})
      `;
    }
  }
}

async function ensureAwpLeads(companyId: string, branchId?: string | null) {
  for (const lead of sampleLeads) {
    let customerId = '';
    const existingCustomer = await sql`
      SELECT id FROM customers
      WHERE company_id = ${companyId} AND lower(email) = ${lead.email.toLowerCase()}
      LIMIT 1
    `;

    if (existingCustomer.length > 0) {
      customerId = String(existingCustomer[0].id);
      await sql`
        UPDATE customers
        SET
          name = ${lead.name},
          phone = ${lead.phone},
          address = ${lead.location},
          notes = ${lead.company ? `Demo company/contact: ${lead.company}` : 'Demo AWP cabin lead'},
          updated_at = datetime('now')
        WHERE id = ${customerId} AND company_id = ${companyId}
      `;
    } else {
      const inserted = await sql`
        INSERT INTO customers (company_id, branch_id, name, email, phone, address, notes)
        VALUES (
          ${companyId},
          ${branchId || null},
          ${lead.name},
          ${lead.email},
          ${lead.phone},
          ${lead.location},
          ${lead.company ? `Demo company/contact: ${lead.company}` : 'Demo AWP cabin lead'}
        )
        RETURNING id
      `;
      customerId = String(inserted[0].id);
    }

    const existingLead = await sql`
      SELECT id FROM leads
      WHERE company_id = ${companyId} AND customer_id = ${customerId} AND issue = ${lead.issue}
      LIMIT 1
    `;
    if (existingLead.length > 0) continue;

    const nextFollowUp = new Date(Date.now() + lead.nextFollowUpDays * 86400_000).toISOString();
    const lastContacted = lead.status === 'new_lead' ? null : new Date(Date.now() - 3 * 86400_000).toISOString();

    await sql`
      INSERT INTO leads (
        company_id,
        branch_id,
        customer_id,
        source,
        status,
        priority,
        issue,
        description,
        location,
        ai_qualification,
        ai_score,
        lead_context_json,
        next_follow_up_at,
        last_contacted_at,
        estimated_value_cents
      )
      VALUES (
        ${companyId},
        ${branchId || null},
        ${customerId},
        ${sourceToSlug(lead.source)},
        ${lead.status},
        ${lead.priority},
        ${lead.issue},
        ${lead.description},
        ${lead.location},
        ${String(lead.context.aiSummary || '')},
        ${lead.aiScore},
        ${JSON.stringify({ ...lead.context, company: lead.company || '', demoData: true, demoKey: lead.key })},
        ${nextFollowUp},
        ${lastContacted},
        ${lead.estimatedValueCents}
      )
    `;
  }
}

async function ensureGrowthDefaults(companyId: string) {
  for (const [recordType, records] of Object.entries(awpDefaultGrowthRecords) as [
    GrowthRecordType,
    (typeof awpDefaultGrowthRecords)[GrowthRecordType],
  ][]) {
    for (const [index, record] of records.entries()) {
      const existing = await sql`
        SELECT id FROM growth_records
        WHERE company_id = ${companyId}
          AND record_type = ${recordType}
          AND source_key = ${record.sourceKey}
        LIMIT 1
      `;

      if (existing.length > 0) continue;

      await sql`
        INSERT INTO growth_records (
          company_id,
          record_type,
          source_key,
          title,
          status,
          owner,
          payload_json,
          is_demo,
          sort_order
        )
        VALUES (
          ${companyId},
          ${recordType},
          ${record.sourceKey},
          ${record.title},
          ${record.status},
          ${record.owner || null},
          ${JSON.stringify(record.payload)},
          ${true},
          ${index}
        )
      `;
    }
  }
}

async function runAwpDemoSeed(companyId: string, branchId?: string | null) {
  await ensureAwpCompanyProfile(companyId);
  await ensureAwpPipeline(companyId);
  await ensureAwpLeads(companyId, branchId);
  await ensureGrowthDefaults(companyId);
}

export async function ensureAwpDemoData(companyId: string, branchId?: string | null) {
  const existing = seedPromises.get(companyId);
  if (existing) return existing;

  const promise = runAwpDemoSeed(companyId, branchId).catch((error) => {
    seedPromises.delete(companyId);
    throw error;
  });
  seedPromises.set(companyId, promise);
  return promise;
}
