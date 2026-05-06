import { NextResponse } from 'next/server';
import { buildAwpAgentContext } from '@/lib/ai/context';
import { isPortalResponse } from '@/lib/auth/tenant';
import { requireModuleOrRespond } from '@/lib/modules/access';

export async function GET(request: Request) {
  const auth = await requireModuleOrRespond('ai-assistant');
  if (isPortalResponse(auth)) return auth;

  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const context = await buildAwpAgentContext(auth.companyId, query);

  return NextResponse.json({
    context: {
      summary: context.summary,
      pipeline: context.pipeline,
      knowledge: context.knowledge,
      sources: context.sources,
      leadCount: context.summary.counts.leads,
      customerCount: context.summary.counts.customers,
      estimateCount: context.summary.counts.estimates,
      invoiceCount: context.summary.counts.invoices,
      growthCount: context.summary.counts.growthRecords,
      knowledgeCount: context.summary.counts.knowledgeItems,
      reusableArchitectureCount: context.summary.counts.reusableArchitecture,
      attachmentCount: context.summary.counts.attachments,
    },
  });
}
