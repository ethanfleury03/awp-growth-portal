import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbPath = path.join(os.tmpdir(), `marketing-agent-${process.pid}.sqlite`);
process.env.SQLITE_PATH = dbPath;

vi.mock('@/lib/ai/openrouter', () => ({
  createOpenRouterChatCompletion: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            reply: 'Built the requested campaign assets and kept outreach approval-gated.',
            objective: 'Create real marketing-agent outputs from a dummy model response.',
            toolCalls: [
              {
                tool: 'create_campaign_draft',
                reason: 'Track each contact through the campaign workflow.',
                input: {
                  title: 'Dummy Realtor Partner Campaign',
                  audience: 'Realtors',
                  goal: 'Start referral conversations.',
                  sequence: [{ day: 1, subject: 'Helping land buyers plan cabins' }],
                  subjectLines: ['Helping land buyers plan cabins'],
                },
              },
              {
                tool: 'create_csv_export',
                reason: 'Give the client a sheet-ready contact export.',
                input: {
                  title: 'Dummy Realtor CSV',
                  columns: ['name', 'email', 'outreachStatus'],
                  rows: [
                    { name: 'Demo Realtor', email: 'demo@example.com', outreachStatus: 'Drafted' },
                  ],
                },
              },
              {
                tool: 'create_table_artifact',
                reason: 'Render a visible table in the output pad.',
                input: {
                  title: 'Dummy Campaign Table',
                  columns: ['segment', 'nextAction'],
                  rows: [{ segment: 'Realtors', nextAction: 'Review approval draft' }],
                },
              },
              {
                tool: 'create_client_document',
                reason: 'Create a client-facing campaign brief.',
                input: {
                  title: 'Dummy Client Campaign Brief',
                  documentType: 'Client Document',
                  markdown: '## Campaign Brief\\nReview the realtor campaign before sending.',
                },
              },
            ],
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 80 },
  })),
}));

import { resetSqliteSingletonForTests, sql } from '@/lib/db';
import { buildMarketingAgentSnapshot, runMarketingAgent } from './agent';

async function seedCompany(companyId: string) {
  await sql`
    INSERT INTO companies (id, name, email, phone, address)
    VALUES (${companyId}, 'AWP Test', 'test@example.com', '555-0100', 'Saranac Lake')
  `;
}

describe('marketing agent', () => {
  beforeEach(() => {
    resetSqliteSingletonForTests();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* test db may not exist yet */
    }
  });

  afterEach(() => {
    resetSqliteSingletonForTests();
  });

  it('turns a model plan into real campaign board and output-pad records', async () => {
    const companyId = '00000000-0000-4000-8000-000000000901';
    await seedCompany(companyId);

    const result = await runMarketingAgent({
      companyId,
      branchId: null,
      userId: 'user_test',
      conversationId: null,
      prompt: 'Create a realtor campaign, CSV, table, and client brief.',
      model: 'deepseek/deepseek-v4-pro',
    });

    expect(result.toolResults.map((tool) => tool.tool)).toEqual([
      'create_campaign_draft',
      'create_csv_export',
      'create_table_artifact',
      'create_client_document',
    ]);

    const campaigns = await sql`
      SELECT payload_json
      FROM growth_records
      WHERE company_id = ${companyId} AND record_type = 'campaign' AND title = 'Dummy Realtor Partner Campaign'
      LIMIT 1
    `;
    const campaignPayload = JSON.parse(String(campaigns[0].payload_json));
    expect(campaignPayload.contactPipeline.length).toBeGreaterThan(0);
    expect(campaignPayload.boardStages).toContain('Awaiting Approval');

    const artifacts = await sql`
      SELECT title, payload_json
      FROM growth_records
      WHERE company_id = ${companyId} AND record_type = 'asset' AND payload_json LIKE ${'%marketing_agent%'}
      ORDER BY title ASC
    `;
    expect(artifacts).toHaveLength(3);
    expect(artifacts.map((row) => String(row.title))).toEqual([
      'Dummy Campaign Table',
      'Dummy Client Campaign Brief',
      'Dummy Realtor CSV',
    ]);

    const csvPayload = JSON.parse(String(artifacts.find((row) => row.title === 'Dummy Realtor CSV')?.payload_json));
    expect(csvPayload.csv).toContain('Demo Realtor,demo@example.com,Drafted');

    const snapshot = await buildMarketingAgentSnapshot(companyId, null);
    expect(snapshot.summary.artifacts).toBe(3);
    expect(snapshot.artifacts.map((artifact) => artifact.title)).toContain('Dummy Client Campaign Brief');
  });
});
