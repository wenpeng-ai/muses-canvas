export type ProviderRuntimeKind = "text" | "image" | "video";
export type ProviderModelKind = ProviderRuntimeKind;

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "grok"
  | "seedance"
  | "hailuo"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "together"
  | "fireworks"
  | "runway"
  | "kling"
  | "sora"
  | "veo"
  | "wan"
  | "custom";

export type ProviderTransport =
  | "openai-compatible"
  | "openai-images"
  | "anthropic"
  | "google"
  | "openrouter"
  | "manual";

export type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  displayName?: string;
};

export type ProviderPlatform = ProviderConfig & {
  id: string;
  providerId: ProviderId;
};

export type ProviderCustomModel = {
  platformId: string;
  providerId: ProviderId;
  modelId: string;
  kind: ProviderModelKind;
  label: string;
  description: string;
};

export type ProviderSettings = {
  providers: Record<ProviderId, ProviderConfig>;
  platforms: ProviderPlatform[];
  defaults: {
    textModel: string;
    imageModel: string;
    videoModel: string;
    imageAspectRatio: string;
  };
  customModels: ProviderCustomModel[];
  hiddenPresetModels: string[];
  disabledModelValues: string[];
};

export type ProviderValidationIssue = {
  field: string;
  message: string;
};

export type NormalizeProviderSettingsOptions = {
  includeEnvironmentDefaults?: boolean;
  includeDefaultModelPlatforms?: boolean;
  hydratePlatformsFromLegacyProviders?: boolean;
};

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  shortLabel: string;
  description: string;
  transport: ProviderTransport;
  defaultBaseUrl: string;
  supportedKinds: ProviderModelKind[];
  runnableKinds: ProviderRuntimeKind[];
  apiKeyPlaceholder: string;
  baseUrlPlaceholder: string;
  baseUrlEditable: boolean;
  note?: string;
};

export type ProviderModelOption = {
  value: string;
  platformId: string;
  providerId: ProviderId;
  modelId: string;
  kind: ProviderModelKind;
  label: string;
  platformLabel: string;
  platformShortLabel: string;
  providerLabel: string;
  providerShortLabel: string;
  description: string;
  preset: boolean;
};

function getEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

const PROVIDER_DEFINITIONS = [
  {
    id: "openai",
    label: "OpenAI",
    shortLabel: "OpenAI",
    description: "GPT text models plus native image generation and edits.",
    transport: "openai-images",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedKinds: ["text", "image"],
    runnableKinds: ["text", "image"],
    apiKeyPlaceholder: "sk-...",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    baseUrlEditable: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    shortLabel: "Claude",
    description: "Claude models through the Messages API.",
    transport: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "sk-ant-...",
    baseUrlPlaceholder: "https://api.anthropic.com/v1",
    baseUrlEditable: true,
  },
  {
    id: "google",
    label: "Google AI",
    shortLabel: "Google",
    description: "Gemini text and Nano Banana image presets through the Gemini API.",
    transport: "google",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    supportedKinds: ["text", "image", "video"],
    runnableKinds: ["text", "image"],
    apiKeyPlaceholder: "AIza...",
    baseUrlPlaceholder:
      "https://generativelanguage.googleapis.com/v1beta/models",
    baseUrlEditable: true,
  },
  {
    id: "grok",
    label: "Grok",
    shortLabel: "Grok",
    description: "xAI Grok text plus native image generation through the xAI API.",
    transport: "openai-images",
    defaultBaseUrl: "https://api.x.ai/v1",
    supportedKinds: ["text", "image"],
    runnableKinds: ["text", "image"],
    apiKeyPlaceholder: "xai-...",
    baseUrlPlaceholder: "https://api.x.ai/v1",
    baseUrlEditable: true,
  },
  {
    id: "seedance",
    label: "Seedance",
    shortLabel: "Seedance",
    description: "Seedance / Seedream image and video presets saved for routing.",
    transport: "manual",
    defaultBaseUrl: "",
    supportedKinds: ["image", "video"],
    runnableKinds: [],
    apiKeyPlaceholder: "Optional",
    baseUrlPlaceholder: "Optional or provider gateway URL",
    baseUrlEditable: true,
    note: "Preset routing is saved now; runtime wiring can be plugged in later.",
  },
  {
    id: "hailuo",
    label: "Hailuo",
    shortLabel: "Hailuo",
    description: "Hailuo image and video presets saved for routing.",
    transport: "manual",
    defaultBaseUrl: "",
    supportedKinds: ["image", "video"],
    runnableKinds: [],
    apiKeyPlaceholder: "Optional",
    baseUrlPlaceholder: "Optional or provider gateway URL",
    baseUrlEditable: true,
    note: "Preset routing is saved now; runtime wiring can be plugged in later.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    shortLabel: "OpenRouter",
    description: "One key for a broad mix of text and image models.",
    transport: "openrouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    supportedKinds: ["text", "image"],
    runnableKinds: ["text", "image"],
    apiKeyPlaceholder: "sk-or-...",
    baseUrlPlaceholder: "https://openrouter.ai/api/v1",
    baseUrlEditable: true,
  },
  {
    id: "groq",
    label: "Groq",
    shortLabel: "Groq",
    description: "Fast OpenAI-compatible text inference.",
    transport: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "gsk_...",
    baseUrlPlaceholder: "https://api.groq.com/openai/v1",
    baseUrlEditable: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    shortLabel: "DeepSeek",
    description: "Direct chat and reasoning models.",
    transport: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "sk-...",
    baseUrlPlaceholder: "https://api.deepseek.com/v1",
    baseUrlEditable: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    shortLabel: "Mistral",
    description: "Official Mistral chat and coding models.",
    transport: "openai-compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "mistral-...",
    baseUrlPlaceholder: "https://api.mistral.ai/v1",
    baseUrlEditable: true,
  },
  {
    id: "together",
    label: "Together",
    shortLabel: "Together",
    description: "Hosted open models behind an OpenAI-compatible API.",
    transport: "openai-compatible",
    defaultBaseUrl: "https://api.together.xyz/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "together-...",
    baseUrlPlaceholder: "https://api.together.xyz/v1",
    baseUrlEditable: true,
  },
  {
    id: "fireworks",
    label: "Fireworks",
    shortLabel: "Fireworks",
    description: "Hosted open models for low-latency text workloads.",
    transport: "openai-compatible",
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    supportedKinds: ["text"],
    runnableKinds: ["text"],
    apiKeyPlaceholder: "fw_...",
    baseUrlPlaceholder: "https://api.fireworks.ai/inference/v1",
    baseUrlEditable: true,
  },
  {
    id: "runway",
    label: "Runway",
    shortLabel: "Runway",
    description: "Saved for video model routing. Runtime wiring can plug in later.",
    transport: "manual",
    defaultBaseUrl: "",
    supportedKinds: ["video"],
    runnableKinds: [],
    apiKeyPlaceholder: "Optional",
    baseUrlPlaceholder: "Optional",
    baseUrlEditable: true,
    note: "Video presets are stored now; execution still uses the existing placeholder path.",
  },
  {
    id: "kling",
    label: "Kling",
    shortLabel: "Kling",
    description: "Kling video presets saved for routing.",
    transport: "manual",
    defaultBaseUrl: "",
    supportedKinds: ["video"],
    runnableKinds: [],
    apiKeyPlaceholder: "Optional",
    baseUrlPlaceholder: "Optional",
    baseUrlEditable: true,
    note: "Video presets are stored now; execution still uses the existing placeholder path.",
  },
  {
    id: "sora",
    label: "Sora",
    shortLabel: "Sora",
    description: "Sora video presets saved for routing.",
    transport: "manual",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedKinds: ["video"],
    runnableKinds: [],
    apiKeyPlaceholder: "sk-...",
    baseUrlPlaceholder: "https://api.openai.com/v1",
    baseUrlEditable: true,
    note: "Sora presets are stored now; runtime wiring can be plugged in later.",
  },
  {
    id: "veo",
    label: "Veo",
    shortLabel: "Veo",
    description: "Native Veo video generation through the Gemini API.",
    transport: "manual",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    supportedKinds: ["video"],
    runnableKinds: ["video"],
    apiKeyPlaceholder: "AIza...",
    baseUrlPlaceholder:
      "https://generativelanguage.googleapis.com/v1beta/models",
    baseUrlEditable: true,
    note: "Supports real Veo video generation with image-to-video input.",
  },
  {
    id: "wan",
    label: "Wan",
    shortLabel: "Wan",
    description: "Saved for video model routing. Runtime wiring can plug in later.",
    transport: "manual",
    defaultBaseUrl: "",
    supportedKinds: ["video"],
    runnableKinds: [],
    apiKeyPlaceholder: "Optional",
    baseUrlPlaceholder: "Optional",
    baseUrlEditable: true,
    note: "Video presets are stored now; execution still uses the existing placeholder path.",
  },
  {
    id: "custom",
    label: "Custom Endpoint",
    shortLabel: "Custom",
    description: "Any OpenAI-compatible endpoint you want to point the canvas at.",
    transport: "openai-compatible",
    defaultBaseUrl:
      getEnvValue("OPENAI_COMPATIBLE_BASE_URL", "CUSTOM_OPENAI_BASE_URL") || "",
    supportedKinds: ["text", "image", "video"],
    runnableKinds: ["text", "image"],
    apiKeyPlaceholder: "Custom API key",
    baseUrlPlaceholder: "https://your-endpoint.example.com/v1",
    baseUrlEditable: true,
    note: "Custom endpoints run text and image now. Add image/video models if your endpoint supports them.",
  },
] as const satisfies readonly ProviderDefinition[];

export const PROVIDER_OPTIONS = [...PROVIDER_DEFINITIONS];

export const GOOGLE_OAUTH_SCOPES = [] as const;
export const GOOGLE_OAUTH_SCOPE = "";

export const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
] as const;

const PRESET_MODELS = [
  {
    providerId: "openai",
    modelId: "gpt-5-mini",
    kind: "text",
    label: "GPT-5 Mini",
    description: "Fast OpenAI default for strong reasoning and editing.",
  },
  {
    providerId: "openai",
    modelId: "gpt-5",
    kind: "text",
    label: "GPT-5",
    description: "Higher-end GPT for more complex text refinement tasks.",
  },
  {
    providerId: "openai",
    modelId: "gpt-5-nano",
    kind: "text",
    label: "GPT-5 Nano",
    description: "Small, low-latency GPT option for lightweight rewrites.",
  },
  {
    providerId: "openai",
    modelId: "gpt-image-1.5",
    kind: "image",
    label: "GPT Image 1.5",
    description: "OpenAI's newer image generation and editing model.",
  },
  {
    providerId: "openai",
    modelId: "gpt-image-1",
    kind: "image",
    label: "GPT Image 1",
    description: "Stable default for OpenAI image generation and edits.",
  },
  {
    providerId: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    kind: "text",
    label: "Claude Sonnet 4",
    description: "Balanced Claude model for product and prompt work.",
  },
  {
    providerId: "anthropic",
    modelId: "claude-opus-4-1-20250805",
    kind: "text",
    label: "Claude Opus 4.1",
    description: "Highest-end Claude preset for deep reasoning tasks.",
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet-20250219",
    kind: "text",
    label: "Claude Sonnet 3.7",
    description: "Strong Claude fallback for long-form and coding edits.",
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-haiku-latest",
    kind: "text",
    label: "Claude Haiku 3.5",
    description: "Fast lower-cost Claude preset.",
  },
  {
    providerId: "google",
    modelId: "gemini-2.5-flash-lite",
    kind: "text",
    label: "Gemini 2.5 Flash-Lite",
    description: "Fast and lower-cost Gemini for lightweight text nodes.",
  },
  {
    providerId: "google",
    modelId: "gemini-2.5-flash",
    kind: "text",
    label: "Gemini 2.5 Flash",
    description: "Balanced Gemini preset for most canvas text workflows.",
  },
  {
    providerId: "google",
    modelId: "gemini-2.5-pro",
    kind: "text",
    label: "Gemini 2.5 Pro",
    description: "Higher-end Gemini reasoning for heavier prompt chains.",
  },
  {
    providerId: "google",
    modelId: "gemini-2.5-flash-image",
    kind: "image",
    label: "Nano Banana",
    description: "Fast native Gemini image generation and editing.",
  },
  {
    providerId: "google",
    modelId: "gemini-3-pro-image-preview",
    kind: "image",
    label: "Nano Banana Pro Preview",
    description: "Higher-fidelity Gemini image preset for richer outputs.",
  },
  {
    providerId: "grok",
    modelId: "grok-3",
    kind: "text",
    label: "Grok 3",
    description: "General-purpose Grok text model from xAI.",
  },
  {
    providerId: "grok",
    modelId: "grok-3-fast",
    kind: "text",
    label: "Grok 3 Fast",
    description: "Lower-latency Grok preset for quick canvas rewrites.",
  },
  {
    providerId: "grok",
    modelId: "grok-imagine-image",
    kind: "image",
    label: "Grok Imagine",
    description: "Native Grok image generation and editing model.",
  },
  {
    providerId: "openrouter",
    modelId: "openai/gpt-5-mini",
    kind: "text",
    label: "GPT-5 Mini via OpenRouter",
    description: "OpenRouter-routed GPT with one shared key.",
  },
  {
    providerId: "openrouter",
    modelId: "anthropic/claude-sonnet-4",
    kind: "text",
    label: "Claude Sonnet 4 via OpenRouter",
    description: "Claude routing without a direct Anthropic account.",
  },
  {
    providerId: "openrouter",
    modelId: "google/gemini-2.5-flash",
    kind: "text",
    label: "Gemini 2.5 Flash via OpenRouter",
    description: "Gemini routed through OpenRouter.",
  },
  {
    providerId: "openrouter",
    modelId: "deepseek/deepseek-chat-v3.2",
    kind: "text",
    label: "DeepSeek Chat via OpenRouter",
    description: "DeepSeek routed through OpenRouter with one key.",
  },
  {
    providerId: "openrouter",
    modelId: "openai/gpt-5-image-mini",
    kind: "image",
    label: "GPT-5 Image Mini via OpenRouter",
    description: "OpenRouter image preset with native multimodal output.",
  },
  {
    providerId: "openrouter",
    modelId: "google/gemini-2.5-flash-image",
    kind: "image",
    label: "Nano Banana via OpenRouter",
    description: "Gemini image routing through OpenRouter.",
  },
  {
    providerId: "openrouter",
    modelId: "sourceful/riverflow-v2-pro",
    kind: "image",
    label: "Riverflow V2 Pro",
    description: "Detailed image generation and editing through OpenRouter.",
  },
  {
    providerId: "groq",
    modelId: "openai/gpt-oss-20b",
    kind: "text",
    label: "GPT-OSS 20B",
    description: "Fast Groq-hosted open-weight reasoning model.",
  },
  {
    providerId: "groq",
    modelId: "openai/gpt-oss-120b",
    kind: "text",
    label: "GPT-OSS 120B",
    description: "Larger Groq-hosted open-weight reasoning model.",
  },
  {
    providerId: "groq",
    modelId: "llama-3.1-8b-instant",
    kind: "text",
    label: "Llama 3.1 8B Instant",
    description: "Ultra-fast Groq preset for lightweight node edits.",
  },
  {
    providerId: "deepseek",
    modelId: "deepseek-chat",
    kind: "text",
    label: "DeepSeek Chat",
    description: "Default non-reasoning DeepSeek chat path.",
  },
  {
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    kind: "text",
    label: "DeepSeek Reasoner",
    description: "Reasoning-oriented DeepSeek preset.",
  },
  {
    providerId: "seedance",
    modelId: "seedance-image",
    kind: "image",
    label: "Seedance Image",
    description: "Seedance still-image preset kept ready for routing.",
  },
  {
    providerId: "seedance",
    modelId: "seedance-video",
    kind: "video",
    label: "Seedance Video",
    description: "Seedance motion preset kept ready for routing.",
  },
  {
    providerId: "hailuo",
    modelId: "hailuo-image",
    kind: "image",
    label: "Hailuo Image",
    description: "Hailuo image preset kept ready for routing.",
  },
  {
    providerId: "hailuo",
    modelId: "hailuo-video",
    kind: "video",
    label: "Hailuo Video",
    description: "Hailuo video preset kept ready for routing.",
  },
  {
    providerId: "mistral",
    modelId: "mistral-medium-latest",
    kind: "text",
    label: "Mistral Medium",
    description: "Balanced Mistral frontier model.",
  },
  {
    providerId: "mistral",
    modelId: "mistral-large-latest",
    kind: "text",
    label: "Mistral Large",
    description: "High-end Mistral general-purpose preset.",
  },
  {
    providerId: "mistral",
    modelId: "codestral-latest",
    kind: "text",
    label: "Codestral",
    description: "Coding-focused Mistral preset.",
  },
  {
    providerId: "together",
    modelId: "deepseek-ai/DeepSeek-V3.1",
    kind: "text",
    label: "DeepSeek V3.1",
    description: "Popular Together-hosted reasoning-free DeepSeek preset.",
  },
  {
    providerId: "together",
    modelId: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
    kind: "text",
    label: "Llama 4 Maverick",
    description: "Large Together-hosted multimodal instruction model.",
  },
  {
    providerId: "together",
    modelId: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    kind: "text",
    label: "Llama 3.3 70B Turbo",
    description: "Reliable Together fallback for fast text tasks.",
  },
  {
    providerId: "fireworks",
    modelId: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    kind: "text",
    label: "Llama v3.3 70B",
    description: "Fireworks-hosted Llama preset.",
  },
  {
    providerId: "fireworks",
    modelId: "accounts/fireworks/models/deepseek-v3",
    kind: "text",
    label: "DeepSeek V3",
    description: "Fireworks-hosted DeepSeek preset.",
  },
  {
    providerId: "fireworks",
    modelId: "accounts/fireworks/models/qwen3-235b-a22b",
    kind: "text",
    label: "Qwen 3 235B",
    description: "Fireworks-hosted Qwen preset.",
  },
  {
    providerId: "runway",
    modelId: "gen4_turbo",
    kind: "video",
    label: "Gen-4 Turbo",
    description: "Runway video preset kept ready for later runtime wiring.",
  },
  {
    providerId: "kling",
    modelId: "kling-video",
    kind: "video",
    label: "Kling Video",
    description: "Existing Kling video preset kept available.",
  },
  {
    providerId: "sora",
    modelId: "sora-2",
    kind: "video",
    label: "Sora 2",
    description: "Sora preset kept ready for cinematic video routing.",
  },
  {
    providerId: "veo",
    modelId: "veo-3.0-fast-generate-001",
    kind: "video",
    label: "Veo 3 Fast",
    description: "Stable Veo video preset for faster generation.",
  },
  {
    providerId: "veo",
    modelId: "veo-3.1-fast-generate-preview",
    kind: "video",
    label: "Veo 3.1 Fast Preview",
    description: "Newer Veo preview preset for higher-end video routing.",
  },
  {
    providerId: "wan",
    modelId: "wan-video",
    kind: "video",
    label: "Wan Video",
    description: "Existing Wan video preset kept available.",
  },
] as const satisfies ReadonlyArray<
  Omit<
    ProviderModelOption,
    | "value"
    | "platformId"
    | "platformLabel"
    | "platformShortLabel"
    | "preset"
    | "providerLabel"
    | "providerShortLabel"
  >
>;

const VALID_PROVIDER_IDS = new Set<ProviderId>(
  PROVIDER_DEFINITIONS.map((provider) => provider.id),
);
const VALID_IMAGE_ASPECT_RATIOS = new Set<string>(
  IMAGE_ASPECT_RATIO_OPTIONS.map((option) => option.value),
);

const PROVIDER_CONFIG_DEFAULTS: Record<ProviderId, ProviderConfig> = {
  openai: {
    apiKey: getEnvValue("OPENAI_API_KEY"),
    baseUrl: getProviderDefinition("openai").defaultBaseUrl,
  },
  anthropic: {
    apiKey: getEnvValue("ANTHROPIC_API_KEY"),
    baseUrl: getProviderDefinition("anthropic").defaultBaseUrl,
  },
  google: {
    apiKey: getEnvValue("GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY"),
    baseUrl: getProviderDefinition("google").defaultBaseUrl,
  },
  grok: {
    apiKey: getEnvValue("XAI_API_KEY", "GROK_API_KEY"),
    baseUrl: getProviderDefinition("grok").defaultBaseUrl,
  },
  seedance: {
    apiKey: getEnvValue("SEEDANCE_API_KEY", "SEEDREAM_API_KEY"),
    baseUrl: getProviderDefinition("seedance").defaultBaseUrl,
  },
  hailuo: {
    apiKey: getEnvValue("HAILUO_API_KEY", "MINIMAX_API_KEY"),
    baseUrl: getProviderDefinition("hailuo").defaultBaseUrl,
  },
  openrouter: {
    apiKey: getEnvValue("OPENROUTER_API_KEY"),
    baseUrl: getProviderDefinition("openrouter").defaultBaseUrl,
  },
  groq: {
    apiKey: getEnvValue("GROQ_API_KEY"),
    baseUrl: getProviderDefinition("groq").defaultBaseUrl,
  },
  deepseek: {
    apiKey: getEnvValue("DEEPSEEK_API_KEY"),
    baseUrl: getProviderDefinition("deepseek").defaultBaseUrl,
  },
  mistral: {
    apiKey: getEnvValue("MISTRAL_API_KEY"),
    baseUrl: getProviderDefinition("mistral").defaultBaseUrl,
  },
  together: {
    apiKey: getEnvValue("TOGETHER_API_KEY"),
    baseUrl: getProviderDefinition("together").defaultBaseUrl,
  },
  fireworks: {
    apiKey: getEnvValue("FIREWORKS_API_KEY"),
    baseUrl: getProviderDefinition("fireworks").defaultBaseUrl,
  },
  runway: {
    apiKey: getEnvValue("RUNWAY_API_KEY"),
    baseUrl: "",
  },
  kling: {
    apiKey: getEnvValue("KLING_API_KEY"),
    baseUrl: "",
  },
  sora: {
    apiKey: getEnvValue("SORA_API_KEY", "OPENAI_API_KEY"),
    baseUrl: getProviderDefinition("sora").defaultBaseUrl,
  },
  veo: {
    apiKey: getEnvValue("VEO_API_KEY", "GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY"),
    baseUrl: getProviderDefinition("veo").defaultBaseUrl,
  },
  wan: {
    apiKey: getEnvValue("WAN_API_KEY"),
    baseUrl: "",
  },
  custom: {
    apiKey: getEnvValue("OPENAI_COMPATIBLE_API_KEY", "CUSTOM_LLM_API_KEY"),
    baseUrl: getProviderDefinition("custom").defaultBaseUrl,
  },
};

function getProviderConfigDefaults(
  providerId: ProviderId,
  options?: NormalizeProviderSettingsOptions,
) {
  if (options?.includeEnvironmentDefaults === false) {
    return {
      apiKey: "",
      baseUrl: getProviderDefinition(providerId).defaultBaseUrl,
    } satisfies ProviderConfig;
  }

  return PROVIDER_CONFIG_DEFAULTS[providerId];
}

function isProviderModelKind(value: unknown): value is ProviderModelKind {
  return value === "text" || value === "image" || value === "video";
}

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && VALID_PROVIDER_IDS.has(value as ProviderId);
}

function normalizeProviderConfig(
  providerId: ProviderId,
  value: Partial<ProviderConfig> | null | undefined,
  options?: NormalizeProviderSettingsOptions,
) {
  const provider = getProviderDefinition(providerId);
  const defaults = getProviderConfigDefaults(providerId, options);
  const apiKey = typeof value?.apiKey === "string" ? value.apiKey : defaults.apiKey;
  const nextBaseUrl = typeof value?.baseUrl === "string" ? value.baseUrl : defaults.baseUrl;

  return {
    apiKey: apiKey.trim(),
    baseUrl: normalizeBaseUrl(nextBaseUrl, provider.defaultBaseUrl),
    displayName:
      typeof value?.displayName === "string" ? value.displayName.trim() : "",
  } satisfies ProviderConfig;
}

function normalizeBaseUrl(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\/+$/, "");
}

function sanitizePlatformId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function createProviderPlatformId(
  providerId: ProviderId,
  existingIds: Set<string>,
  preferredId?: string,
): string {
  const normalizedPreferredId = preferredId ? sanitizePlatformId(preferredId) : "";
  if (normalizedPreferredId && !existingIds.has(normalizedPreferredId)) {
    return normalizedPreferredId;
  }

  let attempt = 1;
  let nextId: string = providerId;
  while (existingIds.has(nextId)) {
    attempt += 1;
    nextId = `${providerId}-${attempt}`;
  }

  return nextId;
}

function normalizeLegacyProviders(
  value: Partial<Record<ProviderId, Partial<ProviderConfig>>> | null | undefined,
  options?: NormalizeProviderSettingsOptions,
) {
  return Object.fromEntries(
    PROVIDER_DEFINITIONS.map((provider) => [
      provider.id,
      normalizeProviderConfig(
        provider.id,
        value?.[provider.id] as Partial<ProviderConfig> | undefined,
        options,
      ),
    ]),
  ) as Record<ProviderId, ProviderConfig>;
}

function collectReferencedProviderIds(params: {
  legacyProviders: Record<ProviderId, ProviderConfig>;
  defaults?: Partial<ProviderSettings["defaults"]> | null;
  customModels?: unknown;
  hiddenPresetModels?: unknown;
  disabledModelValues?: unknown;
  options?: NormalizeProviderSettingsOptions;
}) {
  const referencedProviderIds = new Set<ProviderId>();

  for (const provider of PROVIDER_DEFINITIONS) {
    const config = params.legacyProviders[provider.id];
    const defaults = getProviderConfigDefaults(provider.id, params.options);
    if (
      config.apiKey.trim().length > 0 ||
      config.displayName?.trim() ||
      config.baseUrl !== defaults.baseUrl
    ) {
      referencedProviderIds.add(provider.id);
    }
  }

  if (params.options?.includeDefaultModelPlatforms !== false) {
    for (const value of [
      params.defaults?.textModel,
      params.defaults?.imageModel,
      params.defaults?.videoModel,
    ]) {
      const providerId = typeof value === "string" ? value.split("::", 1)[0] : "";
      if (isProviderId(providerId)) {
        referencedProviderIds.add(providerId);
      }
    }
  }

  if (Array.isArray(params.customModels)) {
    for (const item of params.customModels) {
      const providerId =
        item && typeof item === "object"
          ? (item as Record<string, unknown>).providerId
          : null;
      if (isProviderId(providerId)) {
        referencedProviderIds.add(providerId);
      }
    }
  }

  for (const list of [params.hiddenPresetModels, params.disabledModelValues]) {
    if (!Array.isArray(list)) {
      continue;
    }

    for (const item of list) {
      const providerId = typeof item === "string" ? item.split("::", 1)[0] : "";
      if (isProviderId(providerId)) {
        referencedProviderIds.add(providerId);
      }
    }
  }

  return referencedProviderIds;
}

function normalizeProviderPlatforms(
  value: unknown,
  legacyProviders: Record<ProviderId, ProviderConfig>,
  source?: Partial<ProviderSettings> | null,
  options?: NormalizeProviderSettingsOptions,
) {
  const existingIds = new Set<string>();

  if (Array.isArray(value)) {
    const platforms: ProviderPlatform[] = [];

    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const record = item as Record<string, unknown>;
      if (!isProviderId(record.providerId)) {
        continue;
      }

      const providerId = record.providerId;
      const platformId = createProviderPlatformId(
        providerId,
        existingIds,
        typeof record.id === "string" ? record.id : providerId,
      );
      existingIds.add(platformId);
      const config = normalizeProviderConfig(
        providerId,
        record as Partial<ProviderConfig>,
        options,
      );

      platforms.push({
        id: platformId,
        providerId,
        ...config,
      });
    }

    return platforms;
  }

  if (options?.hydratePlatformsFromLegacyProviders === false) {
    return [] as ProviderPlatform[];
  }

  const referencedProviderIds = collectReferencedProviderIds({
    legacyProviders,
    defaults: source?.defaults,
    customModels: source?.customModels,
    hiddenPresetModels: source?.hiddenPresetModels,
    disabledModelValues: source?.disabledModelValues,
    options,
  });

  return PROVIDER_DEFINITIONS.flatMap((provider) => {
    if (!referencedProviderIds.has(provider.id)) {
      return [];
    }

    const platformId = createProviderPlatformId(provider.id, existingIds, provider.id);
    existingIds.add(platformId);

    return [
      {
        id: platformId,
        providerId: provider.id,
        ...legacyProviders[provider.id],
      },
    ] satisfies ProviderPlatform[];
  });
}

function buildLegacyProviders(
  platforms: ProviderPlatform[],
  options?: NormalizeProviderSettingsOptions,
) {
  return Object.fromEntries(
    PROVIDER_DEFINITIONS.map((provider) => {
      const platform = platforms.find((item) => item.providerId === provider.id);
      return [
        provider.id,
        platform
          ? normalizeProviderConfig(provider.id, platform, options)
          : normalizeProviderConfig(provider.id, null, options),
      ];
    }),
  ) as Record<ProviderId, ProviderConfig>;
}

function buildDefaultProviderPlatforms() {
  const existingIds = new Set<string>();

  return PROVIDER_DEFINITIONS.flatMap((provider) => {
    const config = normalizeProviderConfig(provider.id, null);
    if (!config.apiKey.trim()) {
      return [];
    }

    const platformId = createProviderPlatformId(provider.id, existingIds, provider.id);
    existingIds.add(platformId);

    return [
      {
        id: platformId,
        providerId: provider.id,
        ...config,
      },
    ] satisfies ProviderPlatform[];
  });
}

function getPlatformsForSettings(settings?: ProviderSettings | null) {
  return settings?.platforms ?? DEFAULT_PROVIDER_SETTINGS.platforms;
}

function getPrimaryProviderPlatformInternal(
  platforms: ProviderPlatform[],
  providerId: ProviderId,
) {
  return platforms.find((platform) => platform.providerId === providerId) ?? null;
}

function resolveProviderLabel(
  providerId: ProviderId,
  variant: "label" | "shortLabel" = "label",
) {
  const provider = getProviderDefinition(providerId);
  return variant === "shortLabel" ? provider.shortLabel : provider.label;
}

function resolvePlatformLabel(
  platform: ProviderPlatform,
  platforms: ProviderPlatform[],
  variant: "label" | "shortLabel" = "label",
) {
  const customDisplayName = platform.displayName?.trim();
  if (customDisplayName) {
    return customDisplayName;
  }

  const siblingPlatforms = platforms.filter(
    (item) => item.providerId === platform.providerId,
  );
  const baseLabel = resolveProviderLabel(platform.providerId, variant);
  if (siblingPlatforms.length <= 1) {
    return baseLabel;
  }

  const platformIndex = siblingPlatforms.findIndex((item) => item.id === platform.id);
  return platformIndex >= 0 ? `${baseLabel} ${platformIndex + 1}` : baseLabel;
}

function normalizeCustomModels(
  value: unknown,
  platforms: ProviderPlatform[],
) {
  if (!Array.isArray(value)) {
    return [] as ProviderCustomModel[];
  }

  const seen = new Set<string>();
  const platformsById = new Map(platforms.map((platform) => [platform.id, platform]));

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [] as ProviderCustomModel[];
      }

      const record = item as Record<string, unknown>;
      const kind = isProviderModelKind(record.kind) ? record.kind : null;
      const modelId = typeof record.modelId === "string" ? record.modelId.trim() : "";
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const description =
        typeof record.description === "string" ? record.description.trim() : "";

      if (!kind || !modelId || !label) {
        return [] as ProviderCustomModel[];
      }

      const directPlatformId =
        typeof record.platformId === "string" ? record.platformId.trim() : "";
      const directPlatform = directPlatformId
        ? platformsById.get(directPlatformId)
        : null;
      const legacyProviderId = isProviderId(record.providerId) ? record.providerId : null;
      const fallbackPlatform =
        legacyProviderId !== null
          ? getPrimaryProviderPlatformInternal(platforms, legacyProviderId)
          : null;
      const platform = directPlatform ?? fallbackPlatform;

      if (!platform) {
        return [] as ProviderCustomModel[];
      }

      return [
        {
          platformId: platform.id,
          providerId: platform.providerId,
          modelId,
          kind,
          label,
          description,
        },
      ] satisfies ProviderCustomModel[];
    })
    .filter((model) => {
      const dedupeKey = [
        model.kind,
        model.platformId,
        model.modelId.toLowerCase(),
        model.label.toLowerCase(),
      ].join("::");
      if (seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
}

function normalizeHiddenPresetModels(
  value: unknown,
  availablePresetModelValues: string[],
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const validValues = new Set(availablePresetModelValues);

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!validValues.has(item) || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function buildModelCollection(params?: {
  platforms?: ProviderPlatform[];
  customModels?: ProviderCustomModel[];
  hiddenPresetModels?: string[];
}) {
  const hiddenPresetModels = new Set(params?.hiddenPresetModels ?? []);
  const customModels = params?.customModels ?? [];
  const platforms = params?.platforms ?? [];
  const platformsById = new Map(platforms.map((platform) => [platform.id, platform]));
  const presetOptions: ProviderModelOption[] = platforms.flatMap((platform) =>
    PRESET_MODELS.filter((model) => model.providerId === platform.providerId).map(
      (model) => ({
        ...model,
        value: encodeProviderModel(platform.id, model.modelId),
        platformId: platform.id,
        providerId: platform.providerId,
        platformLabel: resolvePlatformLabel(platform, platforms, "label"),
        platformShortLabel: resolvePlatformLabel(platform, platforms, "shortLabel"),
        providerLabel: resolveProviderLabel(platform.providerId, "label"),
        providerShortLabel: resolveProviderLabel(platform.providerId, "shortLabel"),
        preset: true,
      }),
    ),
  );
  const customOptions: ProviderModelOption[] = customModels.flatMap((model) => {
    const platform =
      platformsById.get(model.platformId) ??
      getPrimaryProviderPlatformInternal(platforms, model.providerId);
    if (!platform) {
      return [] as ProviderModelOption[];
    }

    return [
      {
        value: encodeProviderModel(platform.id, model.modelId),
        platformId: platform.id,
        providerId: platform.providerId,
        modelId: model.modelId,
        kind: model.kind,
        label: model.label,
        platformLabel: resolvePlatformLabel(platform, platforms, "label"),
        platformShortLabel: resolvePlatformLabel(platform, platforms, "shortLabel"),
        providerLabel: resolveProviderLabel(platform.providerId, "label"),
        providerShortLabel: resolveProviderLabel(
          platform.providerId,
          "shortLabel",
        ),
        description: model.description || "Custom model",
        preset: false,
      },
    ] satisfies ProviderModelOption[];
  });

  return [
    ...presetOptions.filter((model) => !hiddenPresetModels.has(model.value)),
    ...customOptions,
  ];
}

function getModelCollection(
  settings?: ProviderSettings | null,
  options?: {
    includeDisabled?: boolean;
  },
) {
  const collection = buildModelCollection({
    platforms: getPlatformsForSettings(settings),
    customModels: settings?.customModels,
    hiddenPresetModels: settings?.hiddenPresetModels,
  });

  if (!settings || options?.includeDisabled) {
    return collection;
  }

  const disabledModelValues = new Set(settings.disabledModelValues ?? []);
  return collection.filter((model) => !disabledModelValues.has(model.value));
}

function getDefaultModelValue(
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
) {
  const sourceDefaults = settings?.defaults ?? DEFAULT_PROVIDER_SETTINGS.defaults;
  return kind === "text"
    ? sourceDefaults.textModel
    : kind === "image"
      ? sourceDefaults.imageModel
      : sourceDefaults.videoModel;
}

const DEFAULT_PROVIDER_PLATFORMS = buildDefaultProviderPlatforms();

export const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  providers: buildLegacyProviders(DEFAULT_PROVIDER_PLATFORMS),
  platforms: DEFAULT_PROVIDER_PLATFORMS,
  defaults: {
    textModel: encodeProviderModel("openai", "gpt-5-mini"),
    imageModel: encodeProviderModel("google", "gemini-2.5-flash-image"),
    videoModel: encodeProviderModel("veo", "veo-3.0-fast-generate-001"),
    imageAspectRatio: "1:1",
  },
  customModels: [],
  hiddenPresetModels: [],
  disabledModelValues: [],
};

const EDITABLE_PROVIDER_SETTINGS_NORMALIZE_OPTIONS = {
  includeEnvironmentDefaults: false,
  includeDefaultModelPlatforms: false,
  // Keep legacy `providers`-only payloads migratable so persisted settings
  // from older builds are not wiped the next time the app normalizes them.
  hydratePlatformsFromLegacyProviders: true,
} satisfies NormalizeProviderSettingsOptions;

export const EMPTY_PROVIDER_SETTINGS: ProviderSettings = {
  providers: buildLegacyProviders([], EDITABLE_PROVIDER_SETTINGS_NORMALIZE_OPTIONS),
  platforms: [],
  defaults: DEFAULT_PROVIDER_SETTINGS.defaults,
  customModels: [],
  hiddenPresetModels: [],
  disabledModelValues: [],
};

export function encodeProviderModel(platformId: string, modelId: string) {
  return `${platformId}::${modelId}`;
}

export function getProviderDefinition(providerId: ProviderId) {
  return (
    PROVIDER_DEFINITIONS.find((provider) => provider.id === providerId) ??
    PROVIDER_DEFINITIONS[0]
  ) as ProviderDefinition;
}

export function getProviderPresetModelTemplates(providerId: ProviderId) {
  return PRESET_MODELS.filter((model) => model.providerId === providerId);
}

export function getProviderPlatforms(
  settings?: ProviderSettings | null,
  providerId?: ProviderId,
) {
  const platforms = getPlatformsForSettings(settings);
  return providerId
    ? platforms.filter((platform) => platform.providerId === providerId)
    : platforms;
}

export function getPrimaryProviderPlatform(
  settings: ProviderSettings | null | undefined,
  providerId: ProviderId,
) {
  return getPrimaryProviderPlatformInternal(getPlatformsForSettings(settings), providerId);
}

export function getProviderPlatform(
  settings: ProviderSettings | null | undefined,
  platformId: string,
) {
  return getPlatformsForSettings(settings).find((platform) => platform.id === platformId) ?? null;
}

export function getProviderPlatformConfig(
  settings: ProviderSettings | null | undefined,
  platformId: string,
  providerId?: ProviderId,
) {
  const platform = getProviderPlatform(settings, platformId);
  if (platform) {
    return normalizeProviderConfig(platform.providerId, platform);
  }

  const fallbackProviderId =
    providerId ?? (isProviderId(platformId) ? (platformId as ProviderId) : null);
  if (fallbackProviderId) {
    return settings?.providers?.[fallbackProviderId] ?? PROVIDER_CONFIG_DEFAULTS[fallbackProviderId];
  }

  return PROVIDER_CONFIG_DEFAULTS[PROVIDER_DEFINITIONS[0].id];
}

export function getProviderConfig(
  settings: ProviderSettings,
  providerId: ProviderId,
) {
  const platform = getPrimaryProviderPlatform(settings, providerId);
  if (platform) {
    return normalizeProviderConfig(providerId, platform);
  }

  return settings.providers[providerId] ?? PROVIDER_CONFIG_DEFAULTS[providerId];
}

export function isProviderPlatformConfigured(
  settings: ProviderSettings,
  platformId: string,
) {
  return getProviderPlatformConfig(settings, platformId).apiKey.trim().length > 0;
}

export function isProviderConfigured(
  settings: ProviderSettings,
  providerId: ProviderId,
) {
  const platforms = getProviderPlatforms(settings, providerId);
  if (platforms.length > 0) {
    return platforms.some((platform) => platform.apiKey.trim().length > 0);
  }

  return getProviderConfig(settings, providerId).apiKey.trim().length > 0;
}

export function providerSupportsKind(
  providerId: ProviderId,
  kind: ProviderModelKind,
) {
  return getProviderDefinition(providerId).supportedKinds.includes(kind);
}

export function providerCanRunKind(
  providerId: ProviderId,
  kind: ProviderRuntimeKind,
) {
  return getProviderDefinition(providerId).runnableKinds.includes(kind);
}

export function providerSupportsInlineVideoImageInput(providerId: ProviderId) {
  if (providerId === "veo") {
    return true;
  }

  const provider = getProviderDefinition(providerId);
  return (
    provider.transport === "google" ||
    provider.transport === "openai-compatible" ||
    provider.transport === "openai-images"
  );
}

export function getProviderModelOptions(
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
  options?: {
    includeDisabled?: boolean;
  },
) {
  return getModelCollection(settings, options).filter((model) => model.kind === kind);
}

export function getConfiguredProviderModelOptions(
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
  options?: {
    includeDisabled?: boolean;
  },
) {
  const sourceSettings = settings ?? DEFAULT_PROVIDER_SETTINGS;

  return getProviderModelOptions(kind, sourceSettings, options).filter((model) =>
    isProviderPlatformConfigured(sourceSettings, model.platformId),
  );
}

export function findProviderModelOption(
  value: string | null | undefined,
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
  options?: {
    includeDisabled?: boolean;
  },
) {
  const normalized = normalizeProviderModelValue(value, kind, settings, options);
  return (
    getProviderModelOptions(kind, settings, options).find(
      (model) => model.value === normalized,
    ) ?? null
  );
}

export function resolveProviderModelSelection(
  value: string | null | undefined,
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
) {
  const normalized = normalizeProviderModelValue(value, kind, settings);
  const [platformId, ...modelParts] = normalized.split("::");
  const modelId = modelParts.join("::");
  const platform = platformId ? getProviderPlatform(settings, platformId) : null;
  const fallbackProviderId = isProviderId(platformId) ? platformId : null;
  const providerId = platform?.providerId ?? fallbackProviderId;

  if (!platformId || !modelId || !providerId) {
    const fallback = normalizeProviderModelValue(
      getDefaultModelValue(kind, settings),
      kind,
      settings,
      { includeDisabled: true },
    );
    const [fallbackPlatformId, ...fallbackModelParts] = fallback.split("::");
    const fallbackPlatform = getProviderPlatform(settings, fallbackPlatformId);
    const fallbackProviderId = fallbackPlatform?.providerId ??
      (isProviderId(fallbackPlatformId) ? fallbackPlatformId : PROVIDER_DEFINITIONS[0].id);

    return {
      value: fallback,
      platformId: fallbackPlatform?.id ?? fallbackPlatformId,
      providerId: fallbackProviderId,
      modelId: fallbackModelParts.join("::"),
    };
  }

  return {
    value: normalized,
    platformId: platform?.id ?? platformId,
    providerId,
    modelId,
  };
}

export function normalizeProviderModelValue(
  value: string | null | undefined,
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
  options?: {
    includeDisabled?: boolean;
  },
) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const availableOptions = getProviderModelOptions(kind, settings, options);
  const fallback = getDefaultModelValue(kind, settings);

  if (!trimmed) {
    return fallback;
  }

  const encodedMatch = availableOptions.find((option) => option.value === trimmed);
  if (encodedMatch) {
    return encodedMatch.value;
  }

  const rawModelMatch = availableOptions.find((option) => option.modelId === trimmed);
  if (rawModelMatch) {
    return rawModelMatch.value;
  }

  if (trimmed.includes("::")) {
    const [platformId, ...modelParts] = trimmed.split("::");
    const modelId = modelParts.join("::").trim();
    const platform =
      getProviderPlatform(settings, platformId) ??
      (isProviderId(platformId)
        ? getPrimaryProviderPlatform(settings, platformId) ??
          ({
            id: platformId,
            providerId: platformId,
            ...getProviderPlatformConfig(settings, platformId, platformId),
          } satisfies ProviderPlatform)
        : null);
    if (
      platform &&
      modelId.length > 0 &&
      providerSupportsKind(platform.providerId, kind)
    ) {
      return encodeProviderModel(platform.id, modelId);
    }
  }

  return fallback;
}

export function getProviderDisplayName(
  providerId: ProviderId,
) {
  return resolveProviderLabel(providerId, "label");
}

export function getProviderShortDisplayName(
  providerId: ProviderId,
) {
  return resolveProviderLabel(providerId, "shortLabel");
}

export function getProviderPlatformDisplayName(
  platformId: string,
  settings?: ProviderSettings | null,
  providerId?: ProviderId,
) {
  const platform = getProviderPlatform(settings, platformId);
  if (platform) {
    return resolvePlatformLabel(platform, getPlatformsForSettings(settings), "label");
  }

  if (providerId) {
    return resolveProviderLabel(providerId, "label");
  }

  return isProviderId(platformId)
    ? resolveProviderLabel(platformId, "label")
    : resolveProviderLabel(PROVIDER_DEFINITIONS[0].id, "label");
}

export function getProviderPlatformShortDisplayName(
  platformId: string,
  settings?: ProviderSettings | null,
  providerId?: ProviderId,
) {
  const platform = getProviderPlatform(settings, platformId);
  if (platform) {
    return resolvePlatformLabel(
      platform,
      getPlatformsForSettings(settings),
      "shortLabel",
    );
  }

  if (providerId) {
    return resolveProviderLabel(providerId, "shortLabel");
  }

  return isProviderId(platformId)
    ? resolveProviderLabel(platformId, "shortLabel")
    : resolveProviderLabel(PROVIDER_DEFINITIONS[0].id, "shortLabel");
}

export function getProviderModelDisplayLabel(
  value: string | null | undefined,
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
) {
  const option = findProviderModelOption(value, kind, settings, {
    includeDisabled: true,
  });
  if (option) {
    return option.label;
  }

  const resolved = resolveProviderModelSelection(value, kind, settings);
  return `${getProviderPlatformDisplayName(resolved.platformId, settings, resolved.providerId)} / ${resolved.modelId}`;
}

export function getProviderModelDescription(
  value: string | null | undefined,
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
) {
  return (
    findProviderModelOption(value, kind, settings, {
      includeDisabled: true,
    })?.description ?? ""
  );
}

function normalizeDisabledModelValues(
  value: unknown,
  availableModelValues: string[],
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const validValues = new Set(availableModelValues);

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      if (!validValues.has(item) || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

export function normalizeProviderSettings(
  value: Partial<ProviderSettings> | null | undefined,
  options?: NormalizeProviderSettingsOptions,
): ProviderSettings {
  const providers = normalizeLegacyProviders(
    value?.providers as Partial<Record<ProviderId, Partial<ProviderConfig>>> | undefined,
    options,
  );
  const platforms = normalizeProviderPlatforms(value?.platforms, providers, value, options);
  const nextProviders = buildLegacyProviders(platforms, options);
  const customModels = normalizeCustomModels(value?.customModels, platforms);
  const availablePresetModelValues = buildModelCollection({
    platforms,
    customModels,
  })
    .filter((model) => model.preset)
    .map((model) => model.value);
  const hiddenPresetModels = normalizeHiddenPresetModels(
    value?.hiddenPresetModels,
    availablePresetModelValues,
  );
  const availableModelValues = buildModelCollection({
    platforms,
    customModels,
    hiddenPresetModels,
  }).map((model) => model.value);
  const disabledModelValues = normalizeDisabledModelValues(
    value?.disabledModelValues,
    availableModelValues,
  );

  const partialSettings = {
    providers: nextProviders,
    platforms,
    defaults: DEFAULT_PROVIDER_SETTINGS.defaults,
    customModels,
    hiddenPresetModels,
    disabledModelValues,
  } satisfies ProviderSettings;

  const textModel = normalizeProviderModelValue(
    value?.defaults?.textModel,
    "text",
    partialSettings,
    { includeDisabled: true },
  );
  const imageModel = normalizeProviderModelValue(
    value?.defaults?.imageModel,
    "image",
    partialSettings,
    { includeDisabled: true },
  );
  const videoModel = normalizeProviderModelValue(
    value?.defaults?.videoModel,
    "video",
    partialSettings,
    { includeDisabled: true },
  );
  const imageAspectRatio =
    typeof value?.defaults?.imageAspectRatio === "string" &&
    VALID_IMAGE_ASPECT_RATIOS.has(value.defaults.imageAspectRatio)
      ? value.defaults.imageAspectRatio
      : DEFAULT_PROVIDER_SETTINGS.defaults.imageAspectRatio;

  return {
    providers: nextProviders,
    platforms,
    defaults: {
      textModel,
      imageModel,
      videoModel,
      imageAspectRatio,
    },
    customModels,
    hiddenPresetModels,
    disabledModelValues,
  };
}

export function normalizeEditableProviderSettings(
  value: Partial<ProviderSettings> | null | undefined,
) {
  return normalizeProviderSettings(value, EDITABLE_PROVIDER_SETTINGS_NORMALIZE_OPTIONS);
}

export function validateProviderSettings(
  settings: ProviderSettings,
): ProviderValidationIssue[] {
  const issues: ProviderValidationIssue[] = [];

  for (const platform of settings.platforms) {
    const config = getProviderPlatformConfig(settings, platform.id, platform.providerId);
    const providerLabel = getProviderPlatformDisplayName(
      platform.id,
      settings,
      platform.providerId,
    );

    if (config.baseUrl.trim().length === 0) {
      issues.push({
        field: `platforms.${platform.id}.baseUrl`,
        message: `${providerLabel} base URL is required.`,
      });
      continue;
    }

    if (config.apiKey.trim().length === 0) {
      issues.push({
        field: `platforms.${platform.id}.apiKey`,
        message: `${providerLabel} API key is required.`,
      });
    }

    try {
      const parsed = new URL(config.baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        issues.push({
          field: `platforms.${platform.id}.baseUrl`,
          message: `${providerLabel} base URL must use http or https.`,
        });
      }
    } catch {
      issues.push({
        field: `platforms.${platform.id}.baseUrl`,
        message: `${providerLabel} base URL is invalid.`,
      });
    }
  }

  const defaults = [
    { kind: "text" as const, value: settings.defaults.textModel },
    { kind: "image" as const, value: settings.defaults.imageModel },
    { kind: "video" as const, value: settings.defaults.videoModel },
  ];

  for (const item of defaults) {
    const availableOptions = getProviderModelOptions(item.kind, settings, {
      includeDisabled: true,
    });
    if (availableOptions.length === 0) {
      continue;
    }

    const option = findProviderModelOption(item.value, item.kind, settings, {
      includeDisabled: true,
    });
    if (!option) {
      issues.push({
        field: `defaults.${item.kind}Model`,
        message: `Choose a supported default ${item.kind} model.`,
      });
      break;
    }
  }

  if (!VALID_IMAGE_ASPECT_RATIOS.has(settings.defaults.imageAspectRatio)) {
    issues.push({
      field: "defaults.imageAspectRatio",
      message: "Choose a supported default image aspect ratio.",
    });
  }

  return issues;
}

export function isProviderModelEnabled(
  settings: ProviderSettings,
  value: string | null | undefined,
) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  return !settings.disabledModelValues.includes(value.trim());
}

export function getEffectiveDefaultProviderModelValue(
  kind: ProviderModelKind,
  settings?: ProviderSettings | null,
  options?: {
    configuredOnly?: boolean;
  },
) {
  const sourceSettings = settings ?? DEFAULT_PROVIDER_SETTINGS;
  const availableOptions = options?.configuredOnly
    ? getConfiguredProviderModelOptions(kind, sourceSettings)
    : getProviderModelOptions(kind, sourceSettings);
  const configuredDefault = getDefaultModelValue(kind, sourceSettings);
  const configuredDefaultOption = findProviderModelOption(
    configuredDefault,
    kind,
    sourceSettings,
    { includeDisabled: true },
  );

  if (
    configuredDefaultOption &&
    isProviderModelEnabled(sourceSettings, configuredDefault) &&
    (!options?.configuredOnly ||
      isProviderPlatformConfigured(
        sourceSettings,
        configuredDefaultOption.platformId,
      ))
  ) {
    return configuredDefault;
  }

  return availableOptions[0]?.value ?? (options?.configuredOnly ? "" : configuredDefault);
}

export function getGoogleImageInputLimit(model: string) {
  switch (model) {
    case "gemini-3-pro-image-preview":
      return 14;
    case "gemini-2.5-flash-image":
    default:
      return 6;
  }
}

export function getImageInputLimit(
  value: string | null | undefined,
  settings?: ProviderSettings | null,
) {
  const resolved = resolveProviderModelSelection(value, "image", settings);

  if (resolved.providerId === "google") {
    return getGoogleImageInputLimit(resolved.modelId);
  }

  if (resolved.providerId === "openai") {
    return 16;
  }

  if (resolved.providerId === "openrouter") {
    return 8;
  }

  return 4;
}
