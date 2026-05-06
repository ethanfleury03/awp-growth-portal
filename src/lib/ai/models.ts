export type AssistantModelCostTier = 'cheap' | 'expensive';

export type AssistantModelOption = {
  id: string;
  name: string;
  description: string;
  costTier: AssistantModelCostTier;
  costLabel: string;
  inputUsdPerToken: number;
  outputUsdPerToken: number;
};

export const ASSISTANT_MODEL_OPTIONS: AssistantModelOption[] = [
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    description: 'Lower-cost daily assistant model',
    costTier: 'cheap',
    costLabel: 'Cheap',
    inputUsdPerToken: 0.000000435,
    outputUsdPerToken: 0.00000087,
  },
  {
    id: '~anthropic/claude-opus-latest',
    name: 'Claude Opus Latest',
    description: 'Premium reasoning model',
    costTier: 'expensive',
    costLabel: 'Expensive',
    inputUsdPerToken: 0.000005,
    outputUsdPerToken: 0.000025,
  },
];

export const IMAGE_ASSISTANT_MODEL: AssistantModelOption = {
  id: 'openai/gpt-5.4-image-2',
  name: 'GPT-5.4 Image 2',
  description: 'Image generation model',
  costTier: 'expensive',
  costLabel: 'Image',
  inputUsdPerToken: 0.000008,
  outputUsdPerToken: 0.000015,
};

const ALL_ASSISTANT_MODELS = [...ASSISTANT_MODEL_OPTIONS, IMAGE_ASSISTANT_MODEL];

export const DEFAULT_ASSISTANT_MODEL_ID = 'deepseek/deepseek-v4-pro';
export const IMAGE_ASSISTANT_MODEL_ID = IMAGE_ASSISTANT_MODEL.id;

export function getAssistantModelOption(modelId: string): AssistantModelOption | undefined {
  return ALL_ASSISTANT_MODELS.find((model) => model.id === modelId);
}

export function normalizeAssistantModelId(modelId: unknown) {
  const id = String(modelId || '');
  return ASSISTANT_MODEL_OPTIONS.find((model) => model.id === id)?.id || DEFAULT_ASSISTANT_MODEL_ID;
}

export function estimateAssistantCostUsd(modelId: string, inputTokens: unknown, outputTokens: unknown): number {
  const model = getAssistantModelOption(modelId);
  if (!model) return 0;
  const input = Number(inputTokens || 0);
  const output = Number(outputTokens || 0);
  const safeInput = Number.isFinite(input) ? input : 0;
  const safeOutput = Number.isFinite(output) ? output : 0;
  return safeInput * model.inputUsdPerToken + safeOutput * model.outputUsdPerToken;
}

export function formatAssistantCost(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '$0.00';
  if (amount > 0 && amount < 0.01) return '<$0.01';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
