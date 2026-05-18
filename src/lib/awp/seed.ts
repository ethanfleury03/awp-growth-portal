import { sql } from '@/lib/db';
import {
  awpBusinessProfile,
  awpEstimateCatalogDefaults,
  awpEstimateDefaults,
  awpDefaultGrowthRecords,
  awpPipelineStages,
  awpReusableArchitectureDefaults,
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

type PipelineBucketRow = {
  id: string;
  title: string;
  color?: string | null;
  position: number;
};

const legacyPipelineSlugs = new Set([
  'new',
  'new_leads',
  'quoted',
  'booked',
  'in_progress',
  'completed',
]);

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

function cleanEnv(value: string | undefined) {
  return (value || '').trim().toLowerCase();
}

export function isAwpDemoSeedEnabled(env: NodeJS.ProcessEnv = process.env) {
  const explicit = cleanEnv(env.AWP_DEMO_SEED_ENABLED);
  if (['1', 'true', 'yes', 'on'].includes(explicit)) return true;
  if (['0', 'false', 'no', 'off'].includes(explicit)) return false;

  const appEnv = cleanEnv(env.APP_ENV);
  if (appEnv === 'staging' || appEnv === 'development' || appEnv === 'test') return true;
  if (appEnv === 'production') return false;

  const vercelEnv = cleanEnv(env.VERCEL_ENV);
  if (vercelEnv === 'preview') return true;
  if (vercelEnv === 'production') return false;

  return cleanEnv(env.NODE_ENV) !== 'production';
}

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

function legacyCustomerIds(companyId: string) {
  return sql`
    SELECT id FROM customers
    WHERE company_id = ${companyId}
      AND (
        lower(email) IN (
          'customer@example.com',
          'sarah.bennett@example.com',
          'marcus.hill@example.com',
          'priya.shah@example.com',
          'elena.torres@example.com',
          'tom.gallagher@example.com',
          'naomi.carter@example.com',
          'ben.alvarez@example.com',
          'madison.reed@example.com',
          'henry.cole@example.com',
          'olivia.brooks@example.com'
        )
        OR (name = 'Jordan Lee' AND phone = '(555) 201-4488')
        OR (
          name = 'Ethan Fleury'
          AND (
            phone IN ('use caller''s current number', '6073731926')
            OR address IN (
              '2840 Mecoon Avenue, Niagara Falls, New York',
              '2840 mckoon ave niagara falls ny'
            )
          )
        )
      )
  `;
}

function legacyLeadIds(companyId: string) {
  return sql`
    SELECT id FROM leads
    WHERE company_id = ${companyId}
      AND customer_id IN (${legacyCustomerIds(companyId)})
  `;
}

function legacyJobIds(companyId: string) {
  return sql`
    SELECT id FROM jobs
    WHERE company_id = ${companyId}
      AND customer_id IN (${legacyCustomerIds(companyId)})
  `;
}

function legacyInvoiceIds(companyId: string) {
  return sql`
    SELECT id FROM invoices
    WHERE company_id = ${companyId}
      AND (
        invoice_number LIKE 'INV-2026-010%'
        OR customer_id IN (${legacyCustomerIds(companyId)})
      )
  `;
}

function legacyEstimateIds(companyId: string) {
  return sql`
    SELECT id FROM estimates
    WHERE company_id = ${companyId}
      AND (
        estimate_number LIKE 'EST-2026-010%'
        OR lower(title) = 'plumbing estimate'
        OR lower(customer_name_snapshot) = 'customer'
        OR customer_id IN (${legacyCustomerIds(companyId)})
        OR lead_id IN (${legacyLeadIds(companyId)})
        OR job_id IN (${legacyJobIds(companyId)})
      )
  `;
}

function legacyPaymentIds(companyId: string) {
  return sql`
    SELECT id FROM payments
    WHERE company_id = ${companyId}
      AND (
        stripe_payment_intent_id LIKE 'pi_demo_%'
        OR lower(customer_email) IN (
          'sarah.bennett@example.com',
          'marcus.hill@example.com',
          'priya.shah@example.com',
          'elena.torres@example.com',
          'tom.gallagher@example.com',
          'naomi.carter@example.com',
          'ben.alvarez@example.com',
          'madison.reed@example.com',
          'henry.cole@example.com',
          'olivia.brooks@example.com'
        )
      )
  `;
}

function legacyServiceContractIds(companyId: string) {
  return sql`
    SELECT id FROM service_contracts
    WHERE company_id = ${companyId}
      AND customer_id IN (${legacyCustomerIds(companyId)})
  `;
}

async function removeLegacyPlumbingDemoData(companyId: string) {
  await sql`DELETE FROM payment_events WHERE payment_id IN (${legacyPaymentIds(companyId)})`;
  await sql`DELETE FROM payments WHERE id IN (${legacyPaymentIds(companyId)})`;

  await sql`DELETE FROM estimate_delivery WHERE estimate_id IN (${legacyEstimateIds(companyId)})`;
  await sql`DELETE FROM estimate_activity WHERE estimate_id IN (${legacyEstimateIds(companyId)})`;
  await sql`DELETE FROM estimate_line_items WHERE estimate_id IN (${legacyEstimateIds(companyId)})`;
  await sql`DELETE FROM estimates WHERE id IN (${legacyEstimateIds(companyId)})`;

  await sql`DELETE FROM invoice_line_items WHERE invoice_id IN (${legacyInvoiceIds(companyId)})`;
  await sql`DELETE FROM invoices WHERE id IN (${legacyInvoiceIds(companyId)})`;

  await sql`DELETE FROM service_contract_schedules WHERE contract_id IN (${legacyServiceContractIds(companyId)})`;
  await sql`DELETE FROM service_contracts WHERE id IN (${legacyServiceContractIds(companyId)})`;

  await sql`DELETE FROM call_logs WHERE company_id = ${companyId} AND lead_id IN (${legacyLeadIds(companyId)})`;
  await sql`DELETE FROM call_logs WHERE company_id = ${companyId} AND job_id IN (${legacyJobIds(companyId)})`;
  await sql`DELETE FROM call_logs WHERE company_id = ${companyId} AND customer_id IN (${legacyCustomerIds(companyId)})`;

  await sql`DELETE FROM jobs WHERE id IN (${legacyJobIds(companyId)})`;
  await sql`DELETE FROM leads WHERE id IN (${legacyLeadIds(companyId)})`;

  await sql`
    DELETE FROM estimate_catalog_services
    WHERE company_id = ${companyId}
      AND lower(name) IN (
        'standard diagnostic visit',
        'clean drainage',
        'drain cleaning - standard',
        'on-site inspection',
        'toilet rebuild',
        'sewer camera inspection',
        'water heater diagnostic',
        'tankless flush service',
        'main drain cleaning',
        'commercial grease line jetting',
        'faucet installation',
        'sump pump replacement'
      )
  `;

  await sql`DELETE FROM customers WHERE id IN (${legacyCustomerIds(companyId)})`;
  await sql`
    DELETE FROM plumbers
    WHERE company_id = ${companyId}
      AND lower(email) LIKE '%@plumberos.demo'
  `;

  await sql`
    DELETE FROM audit_events
    WHERE company_id = ${companyId}
      AND (
        summary LIKE '%plumbing%'
        OR summary LIKE '%Water Heater%'
        OR summary LIKE '%Tankless%'
        OR summary LIKE '%Sump pump%'
        OR entity_id LIKE 'demo-%'
      )
  `;
}

async function listPipelineBuckets(companyId: string): Promise<PipelineBucketRow[]> {
  const rows = await sql`
    SELECT id, title, color, position
    FROM buckets
    WHERE company_id = ${companyId}
    ORDER BY position ASC
  `;

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    color: row.color ? String(row.color) : null,
    position: Number(row.position || 0),
  }));
}

async function normalizeLegacyLeadStatuses(companyId: string) {
  await sql`
    UPDATE leads
    SET status = ${'new_lead'}, updated_at = datetime('now')
    WHERE company_id = ${companyId} AND status IN ('new', 'new_leads')
  `;
  await sql`
    UPDATE leads
    SET status = ${'planning_call_scheduled'}, updated_at = datetime('now')
    WHERE company_id = ${companyId} AND status = 'booked'
  `;
  await sql`
    UPDATE leads
    SET status = ${'proposal_sent'}, updated_at = datetime('now')
    WHERE company_id = ${companyId} AND status = 'quoted'
  `;
  await sql`
    UPDATE leads
    SET status = ${'site_details_needed'}, updated_at = datetime('now')
    WHERE company_id = ${companyId} AND status = 'in_progress'
  `;
  await sql`
    UPDATE leads
    SET status = ${'won'}, updated_at = datetime('now')
    WHERE company_id = ${companyId} AND status = 'completed'
  `;
}

async function ensureAwpEstimateDefaults(companyId: string) {
  await sql`
    INSERT INTO estimate_settings (
      company_id,
      company_name,
      estimate_prefix,
      default_expiration_days,
      default_terms_text,
      estimate_footer_text
    ) VALUES (
      ${companyId},
      ${awpBusinessProfile.businessName},
      ${awpEstimateDefaults.prefix},
      30,
      ${awpEstimateDefaults.terms},
      ${awpEstimateDefaults.footer}
    )
    ON CONFLICT(company_id) DO UPDATE SET
      company_name = CASE
        WHEN estimate_settings.company_name IN ('Company', 'Demo Plumbing Co.', '')
          THEN excluded.company_name
        ELSE estimate_settings.company_name
      END,
      estimate_prefix = CASE
        WHEN estimate_settings.estimate_prefix IN ('EST', 'DEMO', '')
          THEN excluded.estimate_prefix
        ELSE estimate_settings.estimate_prefix
      END,
      default_terms_text = CASE
        WHEN estimate_settings.default_terms_text IS NULL
          OR lower(estimate_settings.default_terms_text) LIKE '%plumbing%'
          OR lower(estimate_settings.default_terms_text) LIKE '%payment due as agreed%'
          THEN excluded.default_terms_text
        ELSE estimate_settings.default_terms_text
      END,
      estimate_footer_text = CASE
        WHEN estimate_settings.estimate_footer_text IS NULL
          OR lower(estimate_settings.estimate_footer_text) LIKE '%plumbing%'
          OR trim(estimate_settings.estimate_footer_text) = ''
          THEN excluded.estimate_footer_text
        ELSE estimate_settings.estimate_footer_text
      END,
      updated_at = datetime('now')
  `;

  for (const [index, item] of awpEstimateCatalogDefaults.entries()) {
    const existing = await sql`
      SELECT id
      FROM estimate_catalog_services
      WHERE company_id = ${companyId}
        AND lower(name) = ${item.name.toLowerCase()}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE estimate_catalog_services
        SET
          description = ${item.description},
          unit_price_cents = ${item.unitPriceCents},
          sort_order = ${index},
          updated_at = datetime('now')
        WHERE id = ${String(existing[0].id)} AND company_id = ${companyId}
      `;
    } else {
      await sql`
        INSERT INTO estimate_catalog_services (
          company_id,
          name,
          description,
          unit_price_cents,
          sort_order
        ) VALUES (
          ${companyId},
          ${item.name},
          ${item.description},
          ${item.unitPriceCents},
          ${index}
        )
      `;
    }
  }
}

export async function ensureAwpPipeline(companyId: string) {
  const existingBuckets = await listPipelineBuckets(companyId);
  const existingSlugs = new Set(existingBuckets.map((bucket) => sourceToSlug(bucket.title)));
  const legacyBuckets = existingBuckets.filter((bucket) => legacyPipelineSlugs.has(sourceToSlug(bucket.title)));

  if (!existingSlugs.has('new_lead') && legacyBuckets.length > 0) {
    for (const [index, bucket] of legacyBuckets.entries()) {
      const stage = awpPipelineStages[index];
      if (!stage) break;
      await sql`
        UPDATE buckets
        SET title = ${stage.label},
            color = ${stage.color},
            position = ${index + 1},
            updated_at = datetime('now')
        WHERE id = ${bucket.id} AND company_id = ${companyId}
      `;
    }
  }

  const refreshedBuckets = await listPipelineBuckets(companyId);
  const refreshedSlugs = new Set(refreshedBuckets.map((bucket) => sourceToSlug(bucket.title)));
  let nextPosition = refreshedBuckets.reduce((max, bucket) => Math.max(max, bucket.position), 0);

  for (const [index, stage] of awpPipelineStages.entries()) {
    if (refreshedSlugs.has(stage.value)) continue;
    nextPosition += 1;
    await sql`
      INSERT INTO buckets (company_id, title, color, position)
      VALUES (${companyId}, ${stage.label}, ${stage.color}, ${nextPosition || index + 1})
    `;
  }

  await normalizeLegacyLeadStatuses(companyId);
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
        ON CONFLICT DO NOTHING
      `;
    }
  }
}

async function ensureReusableArchitectureDefaults(companyId: string) {
  const anyExisting = await sql`
    SELECT id FROM knowledge_items
    WHERE company_id = ${companyId}
      AND item_type = 'Reusable Architecture'
    LIMIT 1
  `;
  if (anyExisting.length > 0) return;

  for (const artifact of awpReusableArchitectureDefaults) {
    await sql`
      INSERT INTO knowledge_items (
        company_id,
        title,
        item_type,
        status,
        body,
        url,
        tags_json,
        source_metadata_json,
        is_pinned
      ) VALUES (
        ${companyId},
        ${artifact.title},
        ${'Reusable Architecture'},
        ${'Active'},
        ${artifact.body},
        ${artifact.source},
        ${JSON.stringify(artifact.tags)},
        ${JSON.stringify({
          key: artifact.key,
          source: artifact.source,
          purpose: artifact.purpose,
          confidence: artifact.confidence,
          aiUse: artifact.aiUse,
          owner: artifact.owner,
        })},
        ${true}
      )
    `;
  }
}

async function runAwpDemoSeed(companyId: string, branchId?: string | null) {
  await ensureAwpCompanyProfile(companyId);
  await removeLegacyPlumbingDemoData(companyId);
  await ensureAwpPipeline(companyId);
  await ensureAwpEstimateDefaults(companyId);
  await ensureAwpLeads(companyId, branchId);
  await ensureGrowthDefaults(companyId);
  await ensureReusableArchitectureDefaults(companyId);
}

export async function ensureAwpDemoData(companyId: string, branchId?: string | null) {
  if (!isAwpDemoSeedEnabled()) return;

  const existing = seedPromises.get(companyId);
  if (existing) return existing;

  const promise = runAwpDemoSeed(companyId, branchId).catch((error) => {
    seedPromises.delete(companyId);
    throw error;
  });
  seedPromises.set(companyId, promise);
  return promise;
}
