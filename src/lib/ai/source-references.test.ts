import { describe, expect, it } from 'vitest';
import { buildDeterministicSources, type SourceContextInput } from '@/lib/ai/context';

function baseInput(overrides: Partial<SourceContextInput> = {}): SourceContextInput {
  return {
    query: '',
    summary: {
      company: {
        name: 'AWP Cabins',
        email: 'hello@example.com',
        phone: '(518) 555-0100',
        address: 'Upstate NY',
      },
      counts: {
        leads: 12,
        customers: 8,
        estimates: 3,
        invoices: 2,
        growthRecords: 6,
        knowledgeItems: 4,
        reusableArchitecture: 1,
        attachments: 2,
        openActionDrafts: 0,
      },
    },
    pipeline: [
      { id: 'bucket_1', title: 'New Lead', status: 'new_lead', color: '#2563eb', count: 4, valueCents: 10000000 },
      { id: 'bucket_2', title: 'Qualified', status: 'qualified', color: '#16a34a', count: 2, valueCents: 6000000 },
    ],
    leads: [],
    customers: [],
    estimates: [],
    invoices: [],
    growth: [],
    knowledge: [],
    ...overrides,
  };
}

describe('deterministic AI source references', () => {
  it('creates knowledge and reusable architecture sources', () => {
    const sources = buildDeterministicSources(baseInput({
      query: 'lead scoring pricing',
      knowledge: [
        {
          id: 'kb_1',
          title: 'Cabin pricing notes',
          itemType: 'Company Facts',
          body: 'Pricing guidance for cabin buyer leads.',
          url: '',
          tags: ['pricing', 'leads'],
          sourceMetadata: { confidence: 'verified' },
          attachments: [],
        },
        {
          id: 'arch_1',
          title: 'Lead scoring rules',
          itemType: 'Reusable Architecture',
          body: 'Durable scoring logic for qualified cabin buyers.',
          url: '',
          tags: ['scoring'],
          sourceMetadata: { confidence: 'likely' },
          attachments: [],
        },
      ],
    }));

    expect(sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'knowledge_item:kb_1',
        kind: 'knowledge_item',
        sourceArea: 'Knowledge Base',
      }),
      expect.objectContaining({
        id: 'knowledge_item:arch_1',
        kind: 'knowledge_item',
        sourceArea: 'Reusable Architecture',
      }),
    ]));
  });

  it('creates child attachment sources with file links', () => {
    const sources = buildDeterministicSources(baseInput({
      query: 'google form',
      knowledge: [
        {
          id: 'kb_1',
          title: 'Google Form',
          itemType: 'Company Facts',
          body: 'Main lead intake form.',
          url: '',
          tags: ['form'],
          sourceMetadata: {},
          attachments: [
            {
              id: 'file_1',
              fileName: 'form-notes.txt',
              mimeType: 'text/plain',
              sizeBytes: 120,
              url: '/api/attachments/file_1',
              contentStatus: 'text_snippet',
              contentSnippet: 'Lead intake questions and routing notes.',
            },
          ],
        },
      ],
    }));

    expect(sources).toContainEqual(expect.objectContaining({
      id: 'attachment:file_1',
      kind: 'attachment',
      href: '/api/attachments/file_1',
      parentId: 'knowledge_item:kb_1',
      evidence: 'Lead intake questions and routing notes.',
    }));
  });

  it('includes matching CRM, financial, and growth records', () => {
    const sources = buildDeterministicSources(baseInput({
      query: 'miller invoice seo quote',
      leads: [
        {
          id: 'lead_1',
          name: 'John Miller',
          email: 'john@example.com',
          phone: '(518) 555-0101',
          interest: 'Second home cabin near Lake Placid',
          description: 'High-intent cabin buyer.',
          source: 'Website Form',
          stage: 'Qualified',
          score: 82,
          value: 32500000,
          nextFollowUpAt: null,
          context: {},
        },
      ],
      customers: [
        {
          id: 'customer_1',
          name: 'Miller Family',
          email: 'miller@example.com',
          phone: '(518) 555-0102',
          address: 'Lake Placid, NY',
          notes: 'Interested in cabins.',
        },
      ],
      estimates: [
        {
          id: 'estimate_1',
          number: 'EST-1001',
          title: 'Cabin quote',
          status: 'Draft',
          customerName: 'John Miller',
          totalCents: 32500000,
          expirationDate: null,
        },
      ],
      invoices: [
        {
          id: 'invoice_1',
          number: 'INV-1001',
          serviceType: 'Deposit invoice',
          status: 'Open',
          customerName: 'John Miller',
          totalCents: 5000000,
          dueDate: null,
          paidDate: null,
        },
      ],
      growth: [
        {
          id: 'growth_1',
          type: 'seo_task',
          title: 'SEO landing page for Lake Placid cabins',
          status: 'Idea',
          owner: 'Marketing',
          relatedRecordId: null,
          isDemo: false,
          payload: { keyword: 'Lake Placid cabin builders' },
        },
      ],
    }));

    expect(sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'lead:lead_1', href: '/crm/leads/lead_1' }),
      expect.objectContaining({ id: 'customer:customer_1', href: '/customers/customer_1' }),
      expect.objectContaining({ id: 'estimate:estimate_1', href: '/estimates/estimate_1' }),
      expect.objectContaining({ id: 'invoice:invoice_1', href: '/invoices' }),
      expect.objectContaining({ id: 'growth_record:growth_1', href: '/marketing' }),
    ]));
  });

  it('keeps broad or empty queries grounded in portal summary and pipeline', () => {
    const sources = buildDeterministicSources(baseInput());

    expect(sources[0]).toEqual(expect.objectContaining({ id: 'portal_summary:current' }));
    expect(sources[1]).toEqual(expect.objectContaining({ id: 'pipeline:crm', href: '/crm' }));
    expect(sources.length).toBeLessThanOrEqual(16);
  });
});
