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
import { awpBusinessProfile } from '@/lib/awp/config';
import { Bot, Check, Database, MessageSquarePlus, Send, Sparkles } from 'lucide-react';

type ModelOption = {
  id: string;
  name: string;
  description: string;
  costLabel: 'Free' | '$' | '$$' | '$$$';
  contextLength: number | null;
};

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
};

type ActionDraft = {
  id: string;
  actionType: string;
  title: string;
  status: string;
  payload?: Record<string, unknown>;
};

type ContextSummary = {
  knowledge?: { id: string; title: string; itemType: string }[];
  leadCount?: number;
  growthCount?: number;
};

const DEFAULT_MODEL = 'openrouter/auto';

function modelLabel(model: ModelOption) {
  return `${model.costLabel} ${model.name} (${model.id})`;
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AiAssistantPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsSource, setModelsSource] = useState('');
  const [configured, setConfigured] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [drafts, setDrafts] = useState<ActionDraft[]>([]);
  const [context, setContext] = useState<ContextSummary>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);

  const loadModels = useCallback(async () => {
    const response = await fetch('/api/ai-assistant/models', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load models');
    setModels(json.models || []);
    setModelsSource(json.source || '');
    setConfigured(Boolean(json.configured));
    const firstModel = json.models?.[0]?.id || DEFAULT_MODEL;
    setSelectedModel((current) => current || firstModel);
  }, []);

  const loadConversations = useCallback(async () => {
    const response = await fetch('/api/ai-assistant/conversations', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load conversations');
    setConversations(json.conversations || []);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    if (!id) return;
    setError('');
    const response = await fetch(`/api/ai-assistant/conversations/${id}`, { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to load conversation');
    setMessages(json.messages || []);
    setDrafts(json.actionDrafts || []);
    if (json.conversation?.selectedModel) setSelectedModel(json.conversation.selectedModel);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadModels(), loadConversations()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load AI assistant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConversations, loadModels]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversation(activeConversationId).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversation'));
    }
  }, [activeConversationId, loadConversation]);

  const selectedModelDetails = useMemo(
    () => models.find((model) => model.id === selectedModel),
    [models, selectedModel],
  );

  function newConversation() {
    setActiveConversationId('');
    setMessages([]);
    setDrafts([]);
    setContext({});
    setInput('');
    setError('');
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
      setDrafts((current) => [...(json.actionDrafts || []), ...current]);
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

  async function confirmDraft(id: string) {
    const response = await fetch(`/api/ai-assistant/actions/${id}/confirm`, { method: 'POST' });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || 'Failed to confirm draft');
      return;
    }
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, status: 'Confirmed' } : draft)));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ops-bg)]">
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6">
          <AppPageHeader
            icon={Bot}
            eyebrow="AI Growth Assistant"
            title="AI Growth Assistant"
            description="A chat-first platform assistant for AWP leads, outreach, marketing, reports, and company knowledge."
            actions={
              <>
                <OpsSelect value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)} className="min-w-[min(460px,100%)]">
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {modelLabel(model)}
                    </option>
                  ))}
                </OpsSelect>
                <OpsButton type="button" variant="primary" onClick={newConversation}>
                  <MessageSquarePlus className="h-4 w-4" />
                  New Chat
                </OpsButton>
              </>
            }
          >
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={configured ? 'success' : 'warning'}>
                {configured ? 'OpenRouter connected' : 'OPENROUTER_API_KEY needed'}
              </StatusBadge>
              <StatusBadge tone="neutral">Models: {modelsSource || 'loading'}</StatusBadge>
              <StatusBadge tone="brand">Draft actions only</StatusBadge>
            </div>
          </AppPageHeader>

          {error ? (
            <div className="rounded-[24px] border border-[var(--ops-danger-soft-border)] bg-[var(--ops-danger-soft)] px-4 py-3 text-sm text-[var(--ops-danger-ink)]">
              {error}
            </div>
          ) : null}

          <div className="grid min-h-[680px] gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
            <ConsolePanel title="Conversations" description="Saved assistant threads.">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-[var(--ops-muted)]">Loading...</p>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-[var(--ops-muted)]">No saved chats yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                        conversation.id === activeConversationId
                          ? 'border-[var(--ops-brand-soft-border)] bg-[var(--ops-brand-soft)]'
                          : 'border-[var(--ops-border)] bg-[var(--ops-surface-strong)] hover:bg-[var(--ops-surface-subtle)]'
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-[var(--ops-text)]">{conversation.title}</p>
                      <p className="mt-1 text-xs text-[var(--ops-muted)]">{formatDate(conversation.updatedAt)}</p>
                    </button>
                  ))
                )}
              </div>
            </ConsolePanel>

            <ConsolePanel
              title={activeConversation?.title || 'New conversation'}
              description="Ask about leads, outreach, marketing, website work, reports, and AWP-specific company knowledge."
              contentClassName="flex min-h-[580px] flex-col"
            >
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <EmptyState
                    title="Ask the AWP assistant"
                    description="Try: Draft a follow-up for hot leads, summarize our outreach work, outline a site prep SEO page, or turn project notes into a case study."
                    icon={Sparkles}
                  />
                ) : (
                  messages.map((message) => (
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
                      <div className="whitespace-pre-wrap text-sm leading-6 text-[var(--ops-text)]">{message.content}</div>
                    </div>
                  ))
                )}
                {sending ? (
                  <div className="mr-auto max-w-[92%] rounded-[24px] border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-5 py-4 text-sm text-[var(--ops-muted)]">
                    Thinking with AWP context...
                  </div>
                ) : null}
              </div>

              <form onSubmit={sendMessage} className="mt-5 border-t border-[var(--ops-border)] pt-5">
                <OpsTextarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask the assistant to analyze leads, draft outreach, create SEO ideas, or use the knowledge base..."
                  rows={4}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      sendMessage();
                    }
                  }}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--ops-muted)]">Ctrl/Cmd + Enter to send. Draft actions require confirmation.</p>
                  <OpsButton type="submit" variant="primary" disabled={sending || !input.trim()}>
                    <Send className="h-4 w-4" />
                    {sending ? 'Sending...' : 'Send'}
                  </OpsButton>
                </div>
              </form>
            </ConsolePanel>

            <div className="space-y-6">
              <ConsolePanel title="Agent Context" description="What the assistant can see for this answer.">
                <div className="space-y-3 text-sm text-[var(--ops-muted)]">
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Business profile</p>
                    <p className="mt-1">{awpBusinessProfile.shortName} / {awpBusinessProfile.primaryRegion}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Portal records</p>
                    <p className="mt-1">{context.leadCount ?? 0} recent leads / {context.growthCount ?? 0} growth records</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                    <p className="font-semibold text-[var(--ops-text)]">Model</p>
                    <p className="mt-1">{selectedModelDetails ? modelLabel(selectedModelDetails) : selectedModel}</p>
                  </div>
                </div>
              </ConsolePanel>

              <ConsolePanel
                title="Knowledge Matches"
                description="Hybrid keyword/tag matches from Settings."
                action={
                  <Link href="/settings" className="text-sm font-semibold text-[var(--ops-brand)] hover:underline">
                    Manage KB
                  </Link>
                }
              >
                <div className="space-y-2">
                  {(context.knowledge || []).length === 0 ? (
                    <p className="text-sm text-[var(--ops-muted)]">Matches will appear after a response.</p>
                  ) : (
                    context.knowledge?.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--ops-text)]">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--ops-muted)]">{item.itemType}</p>
                      </div>
                    ))
                  )}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Draft Actions" description="The assistant can propose changes, not apply them directly.">
                <div className="space-y-3">
                  {drafts.length === 0 ? (
                    <p className="text-sm text-[var(--ops-muted)]">No draft actions yet.</p>
                  ) : (
                    drafts.map((draft) => (
                      <div key={draft.id} className="rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--ops-text)]">{draft.title}</p>
                            <p className="mt-1 text-xs text-[var(--ops-muted)]">{draft.actionType}</p>
                          </div>
                          <StatusBadge tone={draft.status === 'Confirmed' ? 'success' : 'warning'}>{draft.status}</StatusBadge>
                        </div>
                        {draft.status !== 'Confirmed' ? (
                          <OpsButton type="button" variant="secondary" size="sm" className="mt-3" onClick={() => confirmDraft(draft.id)}>
                            <Check className="h-4 w-4" />
                            Confirm Draft
                          </OpsButton>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </ConsolePanel>

              <ConsolePanel title="Guardrails" description="Always active.">
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[var(--ops-warning-soft-border)] bg-[var(--ops-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--ops-warning-ink)]">
                    {awpBusinessProfile.aiGuardrail}
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-[var(--ops-border)] bg-[var(--ops-surface-strong)] px-4 py-3 text-sm text-[var(--ops-muted)]">
                    <Database className="h-4 w-4 text-[var(--ops-brand)]" />
                    Knowledge base retrieval is keyword/tag based in v1.
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
