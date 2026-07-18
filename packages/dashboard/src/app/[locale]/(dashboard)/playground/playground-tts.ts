import type { AudioResult, TtsApiResponse, TtsRequestBody } from './playground-types';

export const MAX_TTS_VOICE_SAMPLE_BYTES = 7_500_000;
export const TTS_OUTPUT_FORMAT = 'wav';

export type TtsVoiceOption = {
  id: string;
  label: string;
};

const MIMO_V2_5_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'mimo_default', label: 'MiMo 默认' },
  { id: '冰糖', label: '冰糖 / 中文女声' },
  { id: '茉莉', label: '茉莉 / 中文女声' },
  { id: '苏打', label: '苏打 / 中文男声' },
  { id: '白桦', label: '白桦 / 中文男声' },
  { id: 'Mia', label: 'Mia / English female' },
  { id: 'Chloe', label: 'Chloe / English female' },
  { id: 'Milo', label: 'Milo / English male' },
  { id: 'Dean', label: 'Dean / English male' },
];

const MIMO_V2_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'mimo_default', label: 'MiMo 默认' },
  { id: 'default_zh', label: 'MiMo 中文女声' },
  { id: 'default_en', label: 'MiMo English female' },
];

export function isTtsModelId(modelId: string) {
  return modelId.toLowerCase().includes('tts');
}

export function isTtsVoiceCloneModel(modelId: string) {
  return modelId.toLowerCase().includes('voiceclone');
}

export function isTtsVoiceDesignModel(modelId: string) {
  return modelId.toLowerCase().includes('voicedesign');
}

export function getTtsVoiceOptions(modelId: string): TtsVoiceOption[] {
  if (isTtsVoiceCloneModel(modelId) || isTtsVoiceDesignModel(modelId)) {
    return [];
  }
  if (modelId === 'mimo-v2-tts') {
    return MIMO_V2_TTS_VOICES;
  }
  return MIMO_V2_5_TTS_VOICES;
}

export function getDefaultTtsVoice(modelId: string) {
  return getTtsVoiceOptions(modelId)[0]?.id ?? '';
}

export function toAudioResult(data: TtsApiResponse, model: string): AudioResult | null {
  const audio = data.choices?.[0]?.message?.audio;
  if (!audio?.data) return null;

  const suffix = audio.id ? `-${audio.id}` : '';
  return {
    id: crypto.randomUUID(),
    src: `data:audio/wav;base64,${audio.data}`,
    mimeType: 'audio/wav',
    filename: `${model}${suffix}.wav`,
  };
}

export function buildTtsRequestBody(params: {
  model: string;
  text: string;
  stylePrompt: string;
  voice: string;
  voiceSampleDataUrl?: string;
}): TtsRequestBody {
  const stylePrompt = params.stylePrompt.trim();
  const messages: TtsRequestBody['messages'] = [];

  if (stylePrompt || isTtsVoiceDesignModel(params.model) || isTtsVoiceCloneModel(params.model)) {
    messages.push({ role: 'user', content: stylePrompt });
  }
  messages.push({ role: 'assistant', content: params.text.trim() });

  const audio: TtsRequestBody['audio'] = { format: TTS_OUTPUT_FORMAT };
  if (isTtsVoiceCloneModel(params.model)) {
    if (params.voiceSampleDataUrl) audio.voice = params.voiceSampleDataUrl;
  } else if (!isTtsVoiceDesignModel(params.model) && params.voice) {
    audio.voice = params.voice;
  }

  return {
    model: params.model,
    messages,
    audio,
    stream: false,
  };
}

export function getTtsVoiceSampleMimeType(file: File): string | null {
  const name = file.name.toLowerCase();
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav' || name.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp3' || name.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  return null;
}

export function getTtsInputError(params: {
  model: string;
  stylePrompt: string;
  voiceSample: File | null;
}): 'ttsStyleRequired' | 'ttsVoiceSampleRequired' | 'ttsVoiceSampleTooLarge' | 'ttsVoiceSampleInvalid' | null {
  if (isTtsVoiceDesignModel(params.model) && !params.stylePrompt.trim()) return 'ttsStyleRequired';
  if (!isTtsVoiceCloneModel(params.model)) return null;
  if (!params.voiceSample) return 'ttsVoiceSampleRequired';
  if (params.voiceSample.size > MAX_TTS_VOICE_SAMPLE_BYTES) return 'ttsVoiceSampleTooLarge';
  if (!getTtsVoiceSampleMimeType(params.voiceSample)) return 'ttsVoiceSampleInvalid';
  return null;
}

export async function fileToTtsVoiceDataUrl(file: File): Promise<string> {
  const mimeType = getTtsVoiceSampleMimeType(file);
  if (!mimeType) {
    throw new Error('unsupported_tts_voice_sample');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}
