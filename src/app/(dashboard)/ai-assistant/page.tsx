'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AppPageHeader,
  ConsolePanel,
  EmptyState,
  OpsButton,
  OpsTextarea,
  StatusBadge,
} from '@/components/ops/ui';
import { awpBusinessProfile } from '@/lib/awp/config';
import { ASSISTANT_MODEL_OPTIONS, DEFAULT_ASSISTANT_MODEL_ID, normalizeAssistantModelId } from '@/lib/ai/models';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bot,
  ClipboardList,
  Database,
  FileText,
  Image as ImageIcon,
  Layers,
  Link2,
  MessageSquarePlus,
  Receipt,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

type Conversation = {
  id: string;
  title: string;
  selectedModel: string;
  updatedAt?: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  model?: string;
  contextSnapshot?: ContextSummary | null;
  sources?: SourceReference[];
  images?: string[];
  responseMode?: string;
};

type ContextSummary = {
  summary?: {
    company?: {
      name: string;
      email: string;
      phone: string;
      address: string;
    };
    counts?: {
      leads: number;
      customers: number;
      estimates: number;
      invoices: number;
      growthRecords: number;
      knowledgeItems: number;
      reusableArchitecture: number;
      attachments: number;
      openActionDrafts: number;
    };
  };
  pipeline?: { id: string; title: string; count: number; valueCents: number }[];
  knowledge?: {
    id: string;
    title: string;
    itemType: string;
    sourceMetadata?: Record<string, unknown>;
    attachments?: { id: string; fileName: string }[];
  }[];
  leadCount?: number;
  customerCount?: number;
  estimateCount?: number;
  invoiceCount?: number;
  growthCount?: number;
  knowledgeCount?: number;
  reusableArchitectureCount?: number;
  attachmentCount?: number;
  sources?: SourceReference[];
  images?: string[];
  responseMode?: string;
};

type SourceReferenceKind =
  | 'portal_summary'
  | 'pipeline'
  | 'lead'
  | 'customer'
  | 'estimate'
  | 'invoice'
  | 'growth_record'
  | 'knowledge_item'
  | 'attachment';

type SourceReference = {
  id: string;
  kind: SourceReferenceKind;
  title: string;
  subtitle: string;
  href: string;
  sourceArea: string;
  evidence: string;
  parentId?: string;
};

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const sourceIcons: Record<SourceReferenceKind, LucideIcon> = {
  portal_summary: Database,
  pipeline: Layers,
  lead: UserRound,
  customer: Users,
  estimate: ClipboardList,
  invoice: Receipt,
  growth_record: Sparkles,
  knowledge_item: BookOpen,
  attachment: FileText,
};

const sourceLabels: Record<SourceReferenceKind, string> = {
  portal_summary: 'Portal',
  pipeline: 'Pipeline',
  lead: 'Lead',
  customer: 'Customer',
  estimate: 'Estimate',
  invoice: 'Invoice',
  growth_record: 'Growth',
  knowledge_item: 'Knowledge',
  attachment: 'File',
};

function SourceRow({ source }: { source: SourceReference }) {
  const Icon = sourceIcons[source.kind] || Link2;
  const content = (
    <div className="group/source flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ops-border-strong)] hover:bg-[var(--ops-surface-subtle)]">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] text-[var(--ops-brand)]">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ops-muted)]">
            {sourceLabels[source.kind]}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--ops-text)]">{source.title}</span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--ops-muted)]">
          {[source.sourceArea, source.subtitle].filter(Boolean).join(' / ')}
        </p>
        {source.evidence ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ops-muted)]">{source.evidence}</p>
        ) : null}
      </div>
      {source.href ? <Link2 className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--ops-muted)] opacity-70 group-hover/source:text-[var(--ops-brand)]" aria-hidden /> : null}
    </div>
  );

  if (!source.href) return content;
  if (source.href.startsWith('/api/')) {
    return (
      <a href={source.href} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }
  return (
    <Link href={source.href} className="block">
      {content}
    </Link>
  );
}

function UsedSources({ sources }: { sources?: SourceReference[] }) {
  if (!sources?.length) return null;
  return (
    <details className="mt-4 border-t border-[var(--ops-border)] pt-3">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ops-muted)] transition-colors hover:text-[var(--ops-text)]">
        <span className="inline-flex items-center gap-2">
          Used sources ({sources.length})
          <span className="text-[10px] normal-case tracking-normal text-[var(--ops-muted)]">click to expand</span>
        </span>
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {sources.map((source) => (
          <SourceRow key={source.id} source={source} />
        ))}
      </div>
    </details>
  );
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
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-sm leading-6 text-[var(--ops-text)]">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (trimmed.startsWith('### ')) {
          return <h4 key={index} className="pt-2 text-sm font-semibold text-[var(--ops-text)]"><InlineMarkdown text={trimmed.slice(4)} /></h4>;
        }
        if (trimmed.startsWith('## ')) {
          return <h3 key={index} className="pt-3 text-base font-semibold tracking-[-0.02em] text-[var(--ops-text)]"><InlineMarkdown text={trimmed.slice(3)} /></h3>;
        }
        if (/^\d+\.\s+/.test(trimmed)) {
          const [, number = '', text = trimmed] = trimmed.match(/^(\d+)\.\s+(.*)$/) || [];
          return (
            <div key={index} className="flex gap-2">
              <span className="min-w-5 font-semibold text-[var(--ops-muted)]">{number}.</span>
              <span><InlineMarkdown text={text} /></span>
            </div>
          );
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

function GeneratedImages({ images }: { images?: string[] }) {
  if (!images?.length) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {images.map((src, index) => (
        <a
          key={`${src.slice(0, 40)}-${index}`}
          href={src}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Generated image ${index + 1}`} className="aspect-square w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export default function AiAssistantPage() {
  const [configured, setConfigured] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_ASSISTANT_MODEL_ID);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [context, setContext] = useState<ContextSummary>({});
  const [input, setInput] = useState('');
  const [imageMode, setImageMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  const loadModelStatus = useCallback(async () => {
    const response = await fetch('/api/ai-assistant/models', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load models');
    setConfigured(Boolean(json.configured));
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/ai-assistant/conversations', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load conversations');
    setConversations(json.conversations || []);
  }, []);

  const loadContext = useCallback(async (query = '') => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const response = await fetch(`/api/ai-assistant/context?${params.toString()}`, { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load assistant context');
    setContext(json.context || {});
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    const response = await fetch(`/api/ai-assistant/conversations/${id}`, { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load conversation');
    setMessages(json.messages || []);
    const snapshot = [...(json.messages || [])].reverse().find((message: Message) => message.contextSnapshot)?.contextSnapshot;
    if (snapshot) setContext(snapshot);
    else await loadContext();
    if (json.conversation?.selectedModel) setSelectedModel(normalizeAssistantModelId(json.conversation.selectedModel));
  }, [loadContext]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadModelStatus(), loadConversations(), loadContext()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load AI assistant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadContext, loadConversations, loadModelStatus]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversation'));
    }
  }, [activeConversationId, loadConversation]);

  const selectedModelDetails = useMemo(
    () => ASSISTANT_MODEL_OPTIONS.find((model) => model.id === selectedModel),
    [selectedModel],
  );
  const modelSelectClass =
    selectedModelDetails?.costTier === 'expensive'
      ? 'border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] text-[var(--ops-danger-ink)]'
      : 'border-[var(--ops-success-soft-border)] bg-[var(--ops-success-soft)] text-[var(--ops-success-ink)]';

  function newConversation() {
    setActiveConversationId('');
    setMessages([]);
    loadContext().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load assistant context'));
    setInput('');
    setError('');
  }

  async function deleteConversation(id: string) {
    const target = conversations.find((conversation) => conversation.id === id);
    const confirmed = window.confirm(`Delete "${target?.title || 'this conversation'}"?`);
    if (!confirmed) return;

    try {
      setError('');
      const response = await fetch(`/api/ai-assistant/conversations/${id}`, { method: 'DELETE' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to delete conversation');

      setConversations((current) => current.filter((conversation) => conversation.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId('');
        setMessages([]);
        await loadContext();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput('');
    setSending(true);
    setError('');
    const tempUserMessage: Message = { id: `local-${Date.now()}`, role: 'user', content: message, model: selectedModel };
    setMessages((current) => [...current, tempUserMessage]);

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId || null,
          model: selectedModel,
          imageMode,
          message,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'AI assistant request failed');

      setActiveConversationId(json.conversationId);
      setMessages((current) => [
        ...current.filter((item) => item.id !== tempUserMessage.id),
        { id: String(json.userMessageId), role: 'user', content: message, model: selectedModel },
        json.assistantMessage,
      ]);
      setContext(json.context || {});
      await loadConversations();
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== tempUserMessage.id));
      setInput(message);
      setError(err instanceof Error ? err.message : 'AI assistant request failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="flex min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6 xl:px-8">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col gap-4">
          <AppPageHeader
            icon={Bot}
            eyebrow="AI Growth Assistant"
            title="AI Growth Assistant"
            description="A chat-first platform assistant for AWP leads, outreach, marketing, reports, and company knowledge."
            actions={
              <OpsButton type="button" variant="primary" onClick={newConversation}>
                <MessageSquarePlus className="h-4 w-4" />
                New Chat
              </OpsButton>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={configured ? 'success' : 'warning'}>
                {configured ? 'OpenRouter connected' : 'OPENROUTER_API_KEY needed'}
              </StatusBadge>
              <StatusBadge tone="neutral">2 model choices</StatusBadge>
              <StatusBadge tone="violet">Image model available</StatusBadge>
            </div>
          </AppPageHeader>

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
            <ConsolePanel title="Conversations" description="Saved assistant threads." className="flex min-h-0 flex-col overflow-hidden" contentClassName="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-[var(--ops-muted)]">Loading...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-[var(--ops-muted)]">No saved chats yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`group relative rounded-2xl border transition-colors ${
                        conversation.id === activeConversationId
                          ? 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]'
                          : 'border-[var(--ops-border)] bg-[var(--ops-surface-strong)] hover:bg-[var(--ops-surface-subtle)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className="w-full rounded-2xl px-4 py-3 pr-11 text-left"
                      >
                        <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{conversation.title}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDate(conversation.updatedAt)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteConversation(conversation.id);
                        }}
                        className="absolute bottom-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-xl border border-transparent text-[var(--ops-muted)] opacity-60 transition-colors hover:border-[var(--ops-danger-soft-border)] hover:bg-[var(--ops-danger-soft)] hover:text-[var(--ops-danger-ink)] group-hover:opacity-100"
                        aria-label={`Delete ${conversation.title}`}
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ConsolePanel>

            <ConsolePanel
              title={activeConversation?.title || 'New conversation'}
              description="Ask about leads, outreach, marketing, website work, reports, and AWP-specific company knowledge."
              className="flex min-h-0 flex-col overflow-hidden"
              contentClassName="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <EmptyState
                    title="Ask the AWP assistant"
                    description="Try: Draft a follow-up for hot leads, summarize our outreach work, outline a site prep SEO page, or turn project notes into a case study."
                    icon={Sparkles}
                  />
                ) : (
                  messages.map((message) => {
                    const sources = message.sources || message.contextSnapshot?.sources || [];
                    const images = message.images || (Array.isArray(message.contextSnapshot?.images) ? message.contextSnapshot.images : []);
                    return (
                      <div
                        key={message.id}
                        className={`rounded-[24px] border px-5 py-4 ${
                          message.role === 'user'
                            ? 'ml-auto max-w-[82%] border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]'
                            : 'mr-auto max-w-[92%] border-[var(--ops-border)] bg-[var(--ops-surface-strong)]'
                        }`}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ops-muted)]">
                          {message.role === 'user' ? 'You' : 'AI Growth Assistant'}
                        </p>
                        <MarkdownMessage content={message.content} />
                        {message.role === 'assistant' ? <GeneratedImages images={images} /> : null}
                        {message.role === 'assistant' ? <UsedSources sources={sources} /> : null}
                      </div>
                    );
                  })
                )}
                {sending ? (
                  <div className="mr-auto max-w-[92%] rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-5 py-4 text-sm text-[var(--ops-muted)]">
                    Thinking with AWP context...
                  </div>
                ) : null}
              </div>

              <form onSubmit={sendMessage} className="mt-4 shrink-0 border-t border-[var(--ops-border)] pt-4">
                <OpsTextarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask the assistant to analyze leads, draft outreach, create SEO ideas, or use the knowledge base..."
                  rows={4}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--ops-muted)]">Ctrl/Cmd + Enter to send. Draft actions require confirmation.</p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setImageMode((current) => !current)}
                      className={`inline-flex h-[54px] items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors ${
                        imageMode
                          ? 'border-[var(--ops-violet-soft-border)] bg-[var(--ops-violet-soft)] text-[var(--ops-violet-ink)]'
                          : 'border-[var(--ops-border)] bg-[var(--ops-surface-strong)] text-[var(--ops-muted)] hover:bg-[var(--ops-surface-subtle)] hover:text-[var(--ops-text)]'
                      }`}
                      aria-pressed={imageMode}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Image
                    </button>
                    <label className="flex items-center gap-2 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-2.5 py-2">
                      <span className="text-xs font-semibold text-[var(--ops-muted)]">Model</span>
                      <select
                        value={selectedModel}
                        onChange={(event) => setSelectedModel(event.target.value as typeof selectedModel)}
                        className={`h-9 min-w-[260px] rounded-xl border px-3 text-sm font-semibold outline-none transition-colors ${modelSelectClass}`}
                        aria-label="AI model"
                      >
                        {ASSISTANT_MODEL_OPTIONS.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.costLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <OpsButton type="submit" variant="primary" disabled={sending || !input.trim()}>
                      <Send className="h-4 w-4" />
                      {sending ? 'Sending...' : 'Send'}
                    </OpsButton>
                  </div>
                </div>
              </form>
            </ConsolePanel>

            <div className="min-h-0 space-y-4 overflow-y-auto">
              <ConsolePanel title="Agent Context" description="What the assistant can see for this answer.">
                <div className="space-y-3 text-sm text-[var(--ops-muted)]">
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Business profile</p>
                    <p className="mt-1">{awpBusinessProfile.shortName} / {awpBusinessProfile.primaryRegion}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Portal records</p>
                    <p className="mt-1">
                      {context.leadCount ?? context.summary?.counts?.leads ?? 0} leads / {context.customerCount ?? context.summary?.counts?.customers ?? 0} customers
                    </p>
                    <p className="mt-1">
                      {context.estimateCount ?? context.summary?.counts?.estimates ?? 0} estimates / {context.invoiceCount ?? context.summary?.counts?.invoices ?? 0} invoices
                    </p>
                    <p className="mt-1">
                      {context.growthCount ?? context.summary?.counts?.growthRecords ?? 0} growth records / {context.knowledgeCount ?? context.summary?.counts?.knowledgeItems ?? 0} KB items
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">CRM pipeline</p>
                    <div className="mt-2 space-y-1">
                      {(context.pipeline || []).slice(0, 5).map((bucket) => (
                        <div key={bucket.id} className="flex items-center justify-between gap-3">
                          <span className="truncate">{bucket.title}</span>
                          <span className="font-semibold text-[var(--ops-text)]">{bucket.count}</span>
                        </div>
                      ))}
                      {(context.pipeline || []).length === 0 ? <p>No buckets loaded yet.</p> : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Model</p>
                    <p className="mt-1">{selectedModelDetails ? `${selectedModelDetails.name} / ${selectedModelDetails.costLabel}` : selectedModel}</p>
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel title="Guardrails" description="Always active.">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--ops-warning-ink)]">
                    {awpBusinessProfile.aiGuardrail}
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-muted)]">
                    <Database className="h-4 w-4 text-[var(--ops-brand)]" />
                    The assistant sees live portal records, CRM pipeline, Settings knowledge, reusable architecture, and file metadata.
                  </div>
                </div>
              </ConsolePanel>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
