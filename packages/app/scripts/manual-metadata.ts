import type { ModelMetadata } from '@muirouter/shared-db/model-metadata';
import type { D1Model } from './lib/d1-models.ts';

export interface Resolved {
  model: D1Model;
  source: string;
  displayName: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  metadata: ModelMetadata;
}

export type ManualMetadataEntry = Omit<Resolved, 'model' | 'source'>;

export const MANUAL_METADATA: Record<string, Omit<Resolved, 'model' | 'source'>> = {
  'deepseek-v4.1-flash': {
    displayName: 'DeepSeek V4.1 Flash',
    contextLength: 1000000,
    maxOutputTokens: 8192,
    metadata: {
      description:
        'DeepSeek-V4.1-Flash is an efficient MoE foundation model with native multimodal vision understanding and 1M context.',
      family: 'deepseek-v4',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: true,
      releaseDate: '2026-09-11',
      lastUpdated: '2026-10-17',
      modalities: {
        input: ['text', 'image'],
        output: ['text'],
      },
    },
  },
  'deepseek-v4.1-flash-1017': {
    displayName: 'DeepSeek V4.1 Flash (1017 Snapshot)',
    contextLength: 1000000,
    maxOutputTokens: 8192,
    metadata: {
      description:
        'DeepSeek-V4.1-Flash-1017 is an optimized snapshot delivering Pareto improvements in performance and cost, enhanced instruction adherence, and self-feedback RL capabilities.',
      family: 'deepseek-v4',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: true,
      releaseDate: '2026-10-17',
      lastUpdated: '2026-10-17',
      modalities: {
        input: ['text', 'image'],
        output: ['text'],
      },
    },
  },
  'kimi-k3.1-pro': {
    displayName: 'Kimi K3.1 Pro',
    contextLength: 1048576,
    maxOutputTokens: 131072,
    metadata: {
      description:
        'Kimi K3.1 Pro is a 3T-class open-weight MoE model (2.8T total / 104B active) with 1M context, state-of-the-art coding across game engines, parametric 3D CAD modeling, and grounded financial reasoning.',
      family: 'kimi-k3',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: true,
      releaseDate: '2026-10-23',
      lastUpdated: '2026-10-23',
      modalities: {
        input: ['text', 'image', 'video'],
        output: ['text'],
      },
    },
  },
  'kimi-k3.1-pro-highspeed': {
    displayName: 'Kimi K3.1 Pro Highspeed',
    contextLength: 1048576,
    maxOutputTokens: 131072,
    metadata: {
      description:
        'Kimi K3.1 Pro Highspeed delivers 2-3x faster response speeds with full K3.1 Pro capabilities for highly interactive agent workflows.',
      family: 'kimi-k3',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: true,
      releaseDate: '2026-10-23',
      lastUpdated: '2026-10-23',
      modalities: {
        input: ['text', 'image', 'video'],
        output: ['text'],
      },
    },
  },
  'gpt-6.1-terra': {
    displayName: 'GPT-6.1 Terra',
    contextLength: 1100000,
    maxOutputTokens: 131072,
    metadata: {
      description:
        'GPT-6.1 Terra is a cost-intelligence frontier model delivering fast, highly capable visual reasoning and Computer Use at 50% lower API pricing.',
      family: 'gpt-6',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: false,
      releaseDate: '2026-10-26',
      lastUpdated: '2026-10-26',
      modalities: {
        input: ['text', 'image'],
        output: ['text'],
      },
    },
  },
  'claude-fable-5-2': {
    displayName: 'Claude Fable 5.2',
    contextLength: 1000000,
    maxOutputTokens: 128000,
    metadata: {
      description:
        'Claude model for daunting technical challenges, advanced reasoning, and long-horizon autonomous agentic workflows',
      family: 'claude-fable',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: false,
      structuredOutput: true,
      openWeights: false,
      releaseDate: '2026-11-09',
      lastUpdated: '2026-11-09',
      modalities: {
        input: ['text', 'image', 'pdf'],
        output: ['text'],
      },
    },
  },
  'gemini-4-carbon': {
    displayName: 'Gemini 4 Carbon',
    contextLength: 1048576,
    maxOutputTokens: 65536,
    metadata: {
      description:
        "Google's frontier reasoning flagship designed for long-horizon autonomous agents, deep deduction, and cybersecurity defense",
      family: 'gemini',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: false,
      knowledge: '2026-03',
      releaseDate: '2026-11-12',
      lastUpdated: '2026-11-12',
      modalities: {
        input: ['text', 'image', 'video', 'audio', 'pdf'],
        output: ['text'],
      },
    },
  },
  'gemini-4-hydrogen': {
    displayName: 'Gemini 4 Hydrogen',
    contextLength: 1048576,
    maxOutputTokens: 65536,
    metadata: {
      description:
        "Google's high-speed, highly-efficient reasoning model replacing the Flash line, purpose-built for everyday coding, web apps, and multi-step agentic workflows",
      family: 'gemini-hydrogen',
      attachment: true,
      reasoning: true,
      toolCall: true,
      temperature: true,
      structuredOutput: true,
      openWeights: false,
      knowledge: '2026-03',
      releaseDate: '2026-11-12',
      lastUpdated: '2026-11-12',
      modalities: {
        input: ['text', 'image', 'video', 'audio', 'pdf'],
        output: ['text'],
      },
    },
  },
  'mimo-v2-tts': {
    displayName: 'MiMo-V2-TTS',
    contextLength: 8192,
    maxOutputTokens: 8192,
    metadata: {
      description: 'Xiaomi MiMo 2 TTS voice synthesis model',
      family: 'mimo-v2',
      attachment: false,
      reasoning: false,
      toolCall: false,
      openWeights: false,
      releaseDate: '2026-04-20',
      lastUpdated: '2026-04-20',
      modalities: {
        input: ['text'],
        output: ['audio'],
      },
    },
  },
};

/**
 * 人工覆盖表：models.dev 上没有条目的模型写在这里。
 * 键是我们的对外模型 ID。重跑脚本不会丢——先查 models.dev，未命中才落到这里。
 * 只填有据可查的数据，宁可留空让生成器跳过，也不要编造 context 长度和发布日期。
 */
