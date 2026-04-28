export type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
    image?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
};

export type ModelOption = {
  id: string;
  name: string;
  description: string;
  contextLength: number | null;
  promptPrice: number;
  completionPrice: number;
  costRank: number;
  costLabel: 'Free' | '$' | '$$' | '$$$';
};

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto',
    description: 'Routes to an available general-purpose model.',
    contextLength: null,
    promptPrice: 0,
    completionPrice: 0,
    costRank: 0,
    costLabel: 'Free',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini Flash',
    description: 'Fast low-cost general assistant model.',
    contextLength: null,
    promptPrice: 0.1,
    completionPrice: 0.4,
    costRank: 1,
    costLabel: '$',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude Sonnet',
    description: 'Stronger reasoning and writing model.',
    contextLength: null,
    promptPrice: 3,
    completionPrice: 15,
    costRank: 2,
    costLabel: '$$',
  },
];

function openRouterHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }
  if (process.env.OPENROUTER_SITE_URL) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
  }
  if (process.env.OPENROUTER_APP_NAME) {
    headers['X-OpenRouter-Title'] = process.env.OPENROUTER_APP_NAME;
  }
  return headers;
}

function price(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function costLabel(cost: number): ModelOption['costLabel'] {
  if (cost <= 0) return 'Free';
  if (cost < 0.000002) return '$';
  if (cost < 0.00002) return '$$';
  return '$$$';
}

function normalizeModel(model: OpenRouterModel): ModelOption | null {
  const inputModalities = model.architecture?.input_modalities || [];
  const outputModalities = model.architecture?.output_modalities || [];
  const modality = model.architecture?.modality || '';
  const supportsText =
    inputModalities.includes('text') ||
    outputModalities.includes('text') ||
    modality.includes('text') ||
    (!inputModalities.length && !outputModalities.length);

  if (!supportsText) return null;

  const promptPrice = price(model.pricing?.prompt);
  const completionPrice = price(model.pricing?.completion);
  const combined = promptPrice + completionPrice;
  const label = costLabel(combined);

  return {
    id: model.id,
    name: model.name || model.id,
    description: model.description || '',
    contextLength: model.context_length || null,
    promptPrice,
    completionPrice,
    costRank: label === 'Free' ? 0 : label === '$' ? 1 : label === '$$' ? 2 : 3,
    costLabel: label,
  };
}

export async function getOpenRouterModels(): Promise<{ models: ModelOption[]; source: 'openrouter' | 'fallback'; error?: string }> {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: openRouterHeaders(),
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message || json.error || 'Failed to load OpenRouter models');
    const models = (Array.isArray(json.data) ? json.data : [])
      .map((model: OpenRouterModel) => normalizeModel(model))
      .filter(Boolean)
      .sort((a: ModelOption, b: ModelOption) => {
        const priceDelta = a.promptPrice + a.completionPrice - (b.promptPrice + b.completionPrice);
        return priceDelta || a.name.localeCompare(b.name);
      })
      .slice(0, 80);

    return { models: models.length ? models : FALLBACK_MODELS, source: models.length ? 'openrouter' : 'fallback' };
  } catch (error) {
    return {
      models: FALLBACK_MODELS,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Failed to load OpenRouter models',
    };
  }
}

export async function createOpenRouterChatCompletion(input: {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
}) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured. Add it to your environment to enable live AI chat.');
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.3,
    }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message || json.error || 'OpenRouter chat request failed');
  }
  return json as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
}
