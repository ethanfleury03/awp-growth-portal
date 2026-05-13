'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppPageHeader,
  ConsolePanel,
  EmptyState,
  OpsButton,
  OpsSelect,
  OpsTextarea,
  StatusBadge,
} from '@/components/ops/ui';
import { CrmWorkspaceTabs } from '@/components/awp/crm-tabs';
import { ASSISTANT_MODEL_OPTIONS, DEFAULT_ASSISTANT_MODEL_ID, normalizeAssistantModelId } from '@/lib/ai/models';
import { formatDateLabel, formatDateTimeLabel } from '@/lib/ops';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  Bot,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  Download,
  FileText,
  Flag,
  Kanban,
  Layers3,
  ListChecks,
  MailCheck,
  Megaphone,
  MessageSquarePlus,
  Play,
  Send,
  Sparkles,
  Table2,
  Target,
  Users,
  WandSparkles,
  Zap,
} from 'lucide-react';

type ModelOption = typeof ASSISTANT_MODEL_OPTIONS[number];

type ToolResult = {
  tool: string;
  status: string;
  title: string;
  description: string;
  href?: string;
  recordId?: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  model?: string;
  createdAt?: string;
  toolResults?: ToolResult[];
  contextSnapshot?: {
    toolResults?: ToolResult[];
    objective?: string;
    nextActions?: string[];
  };
};

type Conversation = {
  id: string;
  title: string;
  selectedModel: string;
  updatedAt?: string;
};

type GrowthRecord = {
  id: string;
  title: string;
  status: string;
  owner: string;
  payload: Record<string, unknown>;
  updatedAt?: string;
};

type Memory = {
  id: string;
  memoryType: string;
  title: string;
  body: string;
  confidence: string;
  source: string;
  metadata: Record<string, unknown>;
  updatedAt?: string;
};

type ActionDraft = {
  id: string;
  actionType: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt?: string;
};

type ToolEvent = {
  id: string;
  toolName: string;
  status: string;
  reason: string;
  output: Record<string, unknown>;
  createdAt?: string;
};

type MarketingContext = {
  summary: {
    leads: number;
    marketableLeads: number;
    customers: number;
    campaigns: number;
    leadLists: number;
    artifacts: number;
    memories: number;
    pendingApprovals: number;
    followUpsDue: number;
  };
  pipeline: { stage: string; label: string; count: number; valueCents: number }[];
  campaigns: GrowthRecord[];
  leadLists: GrowthRecord[];
  artifacts: GrowthRecord[];
  memories: Memory[];
  actionDrafts: ActionDraft[];
  toolEvents: ToolEvent[];
  conversations: Conversation[];
};

const emptyContext: MarketingContext = {
  summary: {
    leads: 0,
    marketableLeads: 0,
    customers: 0,
    campaigns: 0,
    leadLists: 0,
    artifacts: 0,
    memories: 0,
    pendingApprovals: 0,
    followUpsDue: 0,
  },
  pipeline: [],
  campaigns: [],
  leadLists: [],
  artifacts: [],
  memories: [],
  actionDrafts: [],
  toolEvents: [],
  conversations: [],
};

const quickMissions = [
  'Build a realtor partner list from the CRM and draft a 3-touch referral email campaign.',
  'Create a client-ready CSV and table of the best outreach contacts for campground owners.',
  'Draft a client-facing campaign brief document for realtor partner outreach.',
  'Create a campground owner outreach campaign with an approval draft and reusable email asset.',
  'Find high-intent cabin buyers who need follow-up and propose a nurture plan.',
  'Review current campaigns and save durable marketing strategy memories for what to do next.',
];

const toolIcons: Record<string, LucideIcon> = {
  create_audience_list: Users,
  create_campaign_draft: Megaphone,
  create_email_asset: MailCheck,
  create_csv_export: Download,
  create_table_artifact: Table2,
  create_client_document: FileText,
  create_approval_draft: ClipboardCheck,
  create_marketing_task: Flag,
  propose_lead_update: ListChecks,
  save_memory: Brain,
};

function statusTone(status: string): 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet' | 'sky' {
  const normalized = status.toLowerCase();
  if (['active', 'ready', 'confirmed', 'succeeded', 'approved'].includes(normalized)) return 'success';
  if (['draft', 'drafting', 'building', 'needs info'].includes(normalized)) return 'warning';
  if (['failed', 'blocked'].includes(normalized)) return 'danger';
  if (['paused', 'skipped'].includes(normalized)) return 'neutral';
  if (normalized.includes('memory')) return 'violet';
  return 'brand';
}

function stringValue(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function numberLabel(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '0';
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-semibold text-[var(--ops-text)]">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={index} className="rounded-md border border-[var(--ops-border)] bg-[var(--ops-surface-subtle)] px-1.5 py-0.5 text-[12px]">{part.slice(1, -1)}</code>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-6 text-[var(--ops-text)]">
      {content.split('\n').map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (trimmed.startsWith('### ')) {
          return <h4 key={index} className="pt-2 text-sm font-semibold text-[var(--ops-text)]"><InlineMarkdown text={trimmed.slice(4)} /></h4>;
        }
        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ops-muted)]" />
              <span><InlineMarkdown text={trimmed.replace(/^[-*]\s+/, '')} /></span>
            </div>
          );
        }
        return <p key={index}><InlineMarkdown text={trimmed} /></p>;
      })}
    </div>
  );
}

function StatTile({
  label,
  value,
  meta,
  icon: Icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  meta: string;
  icon: LucideIcon;
  tone?: 'brand' | 'success' | 'warning' | 'violet' | 'sky';
}) {
  const toneClass = {
    brand: 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)] text-[var(--ops-brand)]',
    success: 'border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] text-[var(--ops-success-ink)]',
    warning: 'border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] text-[var(--ops-warning-ink)]',
    violet: 'border-[var(--ops-violet-soft-border)] bg-[var(--ops-violet-soft)] text-[var(--ops-violet-ink)]',
    sky: 'border-[var(--ops-sky-soft-border)] bg-[var(--ops-sky-soft)] text-[var(--ops-sky-ink)]',
  }[tone];
  return (
    <div className="min-w-0 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 shadow-[var(--ops-shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ops-text)]">{value}</p>
          <p className="mt-1 truncate text-xs text-[var(--ops-muted)]">{meta}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function RecordRow({
  record,
  href,
  icon: Icon,
}: {
  record: GrowthRecord;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href} className="block rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 transition-colors hover:bg-[var(--ops-surface-subtle)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] text-[var(--ops-brand)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{record.title}</p>
            <StatusBadge tone={statusTone(record.status)}>{record.status}</StatusBadge>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--ops-muted)]">
            {[stringValue(record.payload.audience || record.payload.audienceType), stringValue(record.payload.nextAction || record.payload.source)].filter(Boolean).join(' / ') || record.owner || 'Marketing Agent'}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ToolResultList({ results }: { results?: ToolResult[] }) {
  if (!results?.length) return null;
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {results.map((result, index) => {
        const Icon = toolIcons[result.tool] || Zap;
        const body = (
          <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[var(--ops-brand)]" />
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--ops-text)]">{result.title}</p>
              <StatusBadge tone={statusTone(result.status)}>{result.status}</StatusBadge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">{result.description}</p>
          </div>
        );
        if (!result.href) return <div key={`${result.tool}-${index}`}>{body}</div>;
        if (result.href.startsWith('/api/')) {
          return <a key={`${result.tool}-${index}`} href={result.href}>{body}</a>;
        }
        return <Link key={`${result.tool}-${index}`} href={result.href}>{body}</Link>;
      })}
    </div>
  );
}

function objectRows(value: unknown) {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown>[]
    : [];
}

function stringColumns(value: unknown, rows: Record<string, unknown>[]) {
  if (Array.isArray(value) && value.length) return value.map(String).slice(0, 8);
  const columns = new Set<string>();
  for (const row of rows.slice(0, 4)) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return [...columns].slice(0, 8);
}

function MarketingCampaignBoard({ campaigns }: { campaigns: GrowthRecord[] }) {
  const campaignsWithContacts = campaigns.filter((campaign) => objectRows(campaign.payload.contactPipeline).length > 0);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const selectedCampaign =
    campaignsWithContacts.find((campaign) => campaign.id === activeCampaignId) ||
    campaignsWithContacts[0] ||
    campaigns[0];

  if (!selectedCampaign) {
    return (
      <ConsolePanel title="Email Campaign Board" description="Per-contact progress through each campaign." icon={Kanban}>
        <p className="text-sm text-[var(--ops-muted)]">No campaign board yet. Ask the agent to create an email campaign with a list.</p>
      </ConsolePanel>
    );
  }

  const contactPipeline = objectRows(selectedCampaign.payload.contactPipeline);
  const stages = Array.isArray(selectedCampaign.payload.boardStages) && selectedCampaign.payload.boardStages.length
    ? selectedCampaign.payload.boardStages.map(String)
    : ['Drafted', 'Awaiting Approval', 'Ready', 'Sent', 'Opened', 'Replied', 'Interested', 'Converted'];

  return (
    <ConsolePanel
      title="Email Campaign Board"
      description="A real campaign record board showing where each contact is in the process."
      icon={Kanban}
      action={
        campaignsWithContacts.length > 1 ? (
          <select
            value={selectedCampaign.id}
            onChange={(event) => setActiveCampaignId(event.target.value)}
            className="h-10 max-w-[260px] rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 text-sm text-[var(--ops-text)] outline-none"
            aria-label="Campaign board"
          >
            {campaignsWithContacts.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.title}</option>
            ))}
          </select>
        ) : null
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(selectedCampaign.status)}>{selectedCampaign.status}</StatusBadge>
        <StatusBadge tone="neutral">{numberLabel(contactPipeline.length)} contacts</StatusBadge>
        <StatusBadge tone="sky">{stringValue(selectedCampaign.payload.audience, 'Audience')}</StatusBadge>
      </div>
      {contactPipeline.length === 0 ? (
        <p className="text-sm text-[var(--ops-muted)]">This campaign does not have contacts attached yet.</p>
      ) : (
        <div className="overflow-x-auto pb-1">
          <div
            className="grid min-w-[920px] gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(stages.length, 8)}, minmax(170px, 1fr))` }}
          >
            {stages.slice(0, 8).map((stage) => {
              const stageContacts = contactPipeline.filter((contact) => stringValue(contact.outreachStage, 'Drafted') === stage);
              return (
                <div key={stage} className="min-h-[190px] rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface)] p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ops-muted)]">{stage}</p>
                    <StatusBadge tone={stageContacts.length ? 'brand' : 'neutral'}>{stageContacts.length}</StatusBadge>
                  </div>
                  <div className="space-y-2">
                    {stageContacts.slice(0, 6).map((contact, index) => (
                      <div key={`${stage}-${stringValue(contact.email || contact.name)}-${index}`} className="rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-3 py-2">
                        <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{stringValue(contact.name || contact.businessName, 'Contact')}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--ops-muted)]">{stringValue(contact.email || contact.phone, 'No email')}</p>
                        <p className="mt-1 truncate text-[11px] text-[var(--ops-muted)]">Step {numberLabel(contact.currentStep || 1)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ConsolePanel>
  );
}

function OutputPad({ artifacts }: { artifacts: GrowthRecord[] }) {
  return (
    <ConsolePanel
      title="Output Pad"
      description="Client-ready documents, tables, and sheet-ready CSVs the agent created."
      icon={FileText}
    >
      {artifacts.length === 0 ? (
        <p className="text-sm text-[var(--ops-muted)]">No generated artifacts yet. Ask the agent for a CSV, table, or client-facing campaign brief.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {artifacts.slice(0, 6).map((artifact) => {
            const rows = objectRows(artifact.payload.rows);
            const columns = stringColumns(artifact.payload.columns, rows);
            const markdown = stringValue(artifact.payload.markdown);
            const assetType = stringValue(artifact.payload.assetType, 'Artifact');
            return (
              <div key={artifact.id} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{artifact.title}</p>
                    <p className="mt-1 text-xs text-[var(--ops-muted)]">{assetType} / {stringValue(artifact.payload.audience, 'Marketing Agent')}</p>
                  </div>
                  <Link
                    href={`/api/marketing-agent/artifacts/${artifact.id}/download`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] text-[var(--ops-brand)] hover:bg-[var(--ops-surface-subtle)]"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Link>
                </div>
                {rows.length && columns.length ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--ops-border)]">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-[var(--ops-surface-subtle)] text-[var(--ops-muted)]">
                          <tr>
                            {columns.slice(0, 6).map((column) => (
                              <th key={column} className="px-3 py-2 font-semibold">{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.slice(0, 5).map((row, rowIndex) => (
                            <tr key={rowIndex} className="border-t border-[var(--ops-border)]">
                              {columns.slice(0, 6).map((column) => (
                                <td key={column} className="max-w-[180px] truncate px-3 py-2 text-[var(--ops-text)]">{stringValue(row[column], '-')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : markdown ? (
                  <div className="mt-3 rounded-lg border border-[var(--ops-border)] bg-[var(--ops-surface)] px-3 py-3">
                    <MarkdownMessage content={markdown.split('\n').slice(0, 10).join('\n')} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--ops-muted)]">{stringValue(artifact.payload.description || artifact.payload.notes, 'Draft artifact')}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ConsolePanel>
  );
}

export function MarketingAgentPage() {
  const [configured, setConfigured] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(ASSISTANT_MODEL_OPTIONS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_ASSISTANT_MODEL_ID);
  const [context, setContext] = useState<MarketingContext>(emptyContext);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [approvingId, setApprovingId] = useState('');
  const [error, setError] = useState('');

  const selectedModelDetails = useMemo(
    () => models.find((model) => model.id === selectedModel),
    [models, selectedModel],
  );

  const draftApprovals = context.actionDrafts.filter((draft) => draft.status === 'Draft');

  const loadContext = useCallback(async () => {
    const response = await fetch('/api/marketing-agent/context', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load marketing agent');
    setConfigured(Boolean(json.configured));
    setModels(json.models || ASSISTANT_MODEL_OPTIONS);
    setContext(json.context || emptyContext);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const response = await fetch(`/api/marketing-agent/conversations/${id}`, { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load conversation');
    setMessages(json.messages || []);
    setActiveConversationId(id);
    if (json.conversation?.selectedModel) setSelectedModel(normalizeAssistantModelId(json.conversation.selectedModel));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadContext();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load marketing agent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadContext]);

  function newMission() {
    setActiveConversationId('');
    setMessages([]);
    setInput('');
    setError('');
  }

  async function sendMessage(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const message = (override || input).trim();
    if (!message || sending) return;
    setInput('');
    setSending(true);
    setError('');
    const tempMessage: Message = { id: `local-${Date.now()}`, role: 'user', content: message, model: selectedModel };
    setMessages((current) => [...current, tempMessage]);

    try {
      const response = await fetch('/api/marketing-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId || null,
          model: selectedModel,
          message,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Marketing agent request failed');
      setActiveConversationId(json.conversationId);
      setMessages((current) => [
        ...current.filter((item) => item.id !== tempMessage.id),
        { id: String(json.userMessageId), role: 'user', content: message, model: selectedModel },
        json.assistantMessage,
      ]);
      setContext(json.context || emptyContext);
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== tempMessage.id));
      setInput(message);
      setError(err instanceof Error ? err.message : 'Marketing agent request failed');
    } finally {
      setSending(false);
    }
  }

  async function approveDraft(draft: ActionDraft) {
    const confirmed = window.confirm('Approve this draft inside the portal? This will not send external email.');
    if (!confirmed) return;
    try {
      setApprovingId(draft.id);
      setError('');
      const response = await fetch(`/api/marketing-agent/actions/${draft.id}/confirm`, { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to approve draft');
      await loadContext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve draft');
    } finally {
      setApprovingId('');
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5 xl:px-6">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
          <AppPageHeader
            icon={Bot}
            eyebrow="Cabin Buyer CRM"
            title="Marketing Agent"
            description="Autonomous CRM-aware growth workspace for lists, campaigns, email drafts, memory, and approval-gated outreach."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <CrmWorkspaceTabs active="marketing-agent" />
                <OpsButton type="button" variant="primary" size="sm" onClick={newMission}>
                  <MessageSquarePlus className="h-4 w-4" />
                  New Mission
                </OpsButton>
              </div>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={configured ? 'success' : 'warning'}>
                {configured ? 'OpenRouter connected' : 'OPENROUTER_API_KEY needed'}
              </StatusBadge>
              <StatusBadge tone="violet">Durable memory</StatusBadge>
              <StatusBadge tone="sky">Approval-gated outreach</StatusBadge>
              <StatusBadge tone="neutral">{selectedModelDetails?.name || selectedModel}</StatusBadge>
            </div>
          </AppPageHeader>

          {error ? (
            <div className="rounded-xl border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            <StatTile label="Marketable" value={loading ? '...' : context.summary.marketableLeads} meta={`${numberLabel(context.summary.leads)} CRM leads`} icon={Target} tone="brand" />
            <StatTile label="Campaigns" value={loading ? '...' : context.summary.campaigns} meta="Growth records" icon={Megaphone} tone="sky" />
            <StatTile label="Lead Lists" value={loading ? '...' : context.summary.leadLists} meta="Audience records" icon={Users} tone="success" />
            <StatTile label="Outputs" value={loading ? '...' : context.summary.artifacts} meta="Docs, tables, CSVs" icon={FileText} tone="sky" />
            <StatTile label="Memory" value={loading ? '...' : context.summary.memories} meta="Active learnings" icon={Brain} tone="violet" />
            <StatTile label="Approvals" value={loading ? '...' : context.summary.pendingApprovals} meta="Drafts waiting" icon={ClipboardCheck} tone="warning" />
            <StatTile label="Follow-Up" value={loading ? '...' : context.summary.followUpsDue} meta="Scheduled leads" icon={BadgeCheck} tone="brand" />
          </div>

          <div className="grid min-h-[720px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
            <div className="min-h-0 space-y-4">
              <ConsolePanel title="Mission Control" description="Agent thread, model, and launch queue." icon={WandSparkles}>
                <form onSubmit={sendMessage} className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ops-muted)]">Model</label>
                    <OpsSelect value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} / {model.costLabel}
                        </option>
                      ))}
                    </OpsSelect>
                  </div>
                  <OpsTextarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Give the agent a campaign, list, follow-up, or marketing research mission..."
                    rows={6}
                  />
                  <OpsButton type="submit" variant="primary" className="w-full" disabled={sending || !input.trim()}>
                    <Send className="h-4 w-4" />
                    {sending ? 'Running agent...' : 'Run Agent'}
                  </OpsButton>
                </form>

                <div className="mt-5 space-y-2">
                  {quickMissions.map((mission) => (
                    <button
                      key={mission}
                      type="button"
                      onClick={() => sendMessage(undefined, mission)}
                      disabled={sending}
                      className="flex w-full items-start gap-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface)] px-3 py-2.5 text-left text-sm text-[var(--ops-text)] transition-colors hover:bg-[var(--ops-surface-subtle)] disabled:opacity-60"
                    >
                      <Play className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ops-brand)]" />
                      <span className="leading-5">{mission}</span>
                    </button>
                  ))}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Threads" description="Recent marketing-agent missions." icon={MessageSquarePlus}>
                <div className="space-y-2">
                  {context.conversations.length === 0 ? (
                    <p className="text-sm text-[var(--ops-muted)]">No agent missions yet.</p>
                  ) : (
                    context.conversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => loadConversation(conversation.id).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversation'))}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          conversation.id === activeConversationId
                            ? 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]'
                            : 'border-[var(--ops-border)] bg-[var(--ops-surface-strong)] hover:bg-[var(--ops-surface-subtle)]'
                        }`}
                      >
                        <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{conversation.title}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDateLabel(conversation.updatedAt)}</p>
                      </button>
                    ))
                  )}
                </div>
              </ConsolePanel>
            </div>

            <ConsolePanel
              title="Agent Console"
              description="Plans, tool work, records created, and CRM-aware responses."
              icon={Sparkles}
              className="flex min-h-0 flex-col overflow-hidden"
              contentClassName="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <EmptyState
                    title="Marketing agent ready"
                    description="Launch a mission to create CRM-backed lists, campaigns, email assets, memory, and approval drafts."
                    icon={DatabaseZap}
                  />
                ) : (
                  messages.map((message) => {
                    const results = message.toolResults || message.contextSnapshot?.toolResults || [];
                    return (
                      <div
                        key={message.id}
                        className={`rounded-xl border px-5 py-4 ${
                          message.role === 'user'
                            ? 'ml-auto max-w-[82%] border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]'
                            : 'mr-auto max-w-[94%] border-[var(--ops-border)] bg-[var(--ops-surface-strong)]'
                        }`}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">
                          {message.role === 'user' ? 'Mission' : 'Marketing Agent'}
                        </p>
                        <MarkdownMessage content={message.content} />
                        {message.role === 'assistant' ? <ToolResultList results={results} /> : null}
                      </div>
                    );
                  })
                )}
                {sending ? (
                  <div className="mr-auto max-w-[94%] rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-5 py-4 text-sm text-[var(--ops-muted)]">
                    Running planning pass, validating tools, and writing portal records...
                  </div>
                ) : null}
              </div>
            </ConsolePanel>

            <div className="min-h-0 space-y-4 overflow-y-auto">
              <ConsolePanel title="Approval Queue" description="Drafts that can become outreach when integrations are connected." icon={ClipboardCheck}>
                <div className="space-y-3">
                  {draftApprovals.length === 0 ? (
                    <p className="text-sm text-[var(--ops-muted)]">No pending approvals.</p>
                  ) : (
                    draftApprovals.slice(0, 6).map((draft) => (
                      <div key={draft.id} className="rounded-xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{draft.title}</p>
                            <p className="mt-1 text-xs text-[var(--ops-warning-ink)]">
                              {[stringValue(draft.payload.channel, 'email'), stringValue(draft.payload.recipientPreview)].filter(Boolean).join(' / ')}
                            </p>
                          </div>
                          <StatusBadge tone="warning">{draft.status}</StatusBadge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">
                          {stringValue(draft.payload.riskNotes || draft.payload.notes || draft.payload.goal, 'Approval required before any live outreach integration can use this draft.')}
                        </p>
                        <OpsButton
                          type="button"
                          size="sm"
                          variant="warning"
                          className="mt-3 w-full"
                          onClick={() => approveDraft(draft)}
                          disabled={approvingId === draft.id}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {approvingId === draft.id ? 'Approving...' : 'Approve Draft'}
                        </OpsButton>
                      </div>
                    ))
                  )}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Agent Memory" description="Durable decisions and growth learnings." icon={Brain}>
                <div className="space-y-3">
                  {context.memories.length === 0 ? (
                    <p className="text-sm text-[var(--ops-muted)]">No marketing memories saved yet.</p>
                  ) : (
                    context.memories.slice(0, 6).map((memory) => (
                      <div key={memory.id} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-[var(--ops-text)]">{memory.title}</p>
                          <StatusBadge tone="violet">{memory.confidence}</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ops-muted)]">{memory.memoryType}</p>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--ops-muted)]">{memory.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </ConsolePanel>
            </div>
          </div>

          <MarketingCampaignBoard campaigns={context.campaigns} />

          <OutputPad artifacts={context.artifacts} />

          <div className="grid gap-4 xl:grid-cols-3">
            <ConsolePanel title="Campaign Drafts" description="Latest campaign records touched by the agent and outreach workspace." icon={Megaphone}>
              <div className="space-y-3">
                {context.campaigns.slice(0, 5).map((record) => (
                  <RecordRow key={record.id} record={record} href="/outreach?tab=campaigns" icon={Megaphone} />
                ))}
                {context.campaigns.length === 0 ? <p className="text-sm text-[var(--ops-muted)]">No campaigns yet.</p> : null}
              </div>
            </ConsolePanel>

            <ConsolePanel title="Audience Lists" description="Segment records and CRM-sourced contact lists." icon={Users}>
              <div className="space-y-3">
                {context.leadLists.slice(0, 5).map((record) => (
                  <RecordRow key={record.id} record={record} href="/outreach?tab=lists" icon={Users} />
                ))}
                {context.leadLists.length === 0 ? <p className="text-sm text-[var(--ops-muted)]">No lead lists yet.</p> : null}
              </div>
            </ConsolePanel>

            <ConsolePanel title="Tool Trace" description="Recent validated agent actions." icon={Activity}>
              <div className="space-y-3">
                {context.toolEvents.slice(0, 7).map((event) => {
                  const Icon = toolIcons[event.toolName] || Layers3;
                  return (
                    <div key={event.id} className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[var(--ops-brand)]" />
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ops-text)]">{event.toolName.replace(/_/g, ' ')}</p>
                        <StatusBadge tone={statusTone(event.status)}>{event.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDateTimeLabel(event.createdAt)}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">
                        {event.reason || stringValue(event.output.description) || 'Validated agent action.'}
                      </p>
                    </div>
                  );
                })}
                {context.toolEvents.length === 0 ? <p className="text-sm text-[var(--ops-muted)]">No tool events yet.</p> : null}
              </div>
            </ConsolePanel>
          </div>
        </div>
      </main>
    </div>
  );
}
