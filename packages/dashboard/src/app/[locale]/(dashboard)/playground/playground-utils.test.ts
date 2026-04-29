import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '@/lib/api';
import {
  appendBuiltInPlaygroundModels,
  buildTtsRequestBody,
  getTtsVoiceSampleMimeType,
  isImageModel,
  isTtsModel,
  toAudioResult,
} from './playground-utils';

function createModel(id: string, upstreamModelId: string | null = id): ModelInfo {
  return {
    id,
    provider: 'xiaomi-mimo',
    upstreamModelId,
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
  };
}

describe('playground TTS helpers', () => {
  it('补齐内置图片和 MiMo TTS 模型且不重复添加', () => {
    const models = appendBuiltInPlaygroundModels([createModel('mimo-v2.5-tts')]);

    expect(models.filter((model) => model.id === 'mimo-v2.5-tts')).toHaveLength(1);
    expect(models.some((model) => model.id === 'gpt-image-2')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voiceclone')).toBe(true);
    expect(models.some((model) => model.id === 'mimo-v2.5-tts-voicedesign')).toBe(true);
  });

  it('识别 TTS 模型且不会把 TTS 归入图片模型', () => {
    const model = createModel('mimo-v2.5-tts');

    expect(isTtsModel(model)).toBe(true);
    expect(isImageModel(model)).toBe(false);
  });

  it('为内置音色 TTS 构造 MiMo chat completions 请求体', () => {
    expect(
      buildTtsRequestBody({
        model: 'mimo-v2.5-tts',
        text: '今天会议开始了。',
        stylePrompt: '温暖、明亮，语速稍快。',
        voice: 'Chloe',
      }),
    ).toEqual({
      model: 'mimo-v2.5-tts',
      messages: [
        { role: 'user', content: '温暖、明亮，语速稍快。' },
        { role: 'assistant', content: '今天会议开始了。' },
      ],
      audio: { format: 'wav', voice: 'Chloe' },
      stream: false,
    });
  });

  it('音色设计模型不发送预设 voice', () => {
    const body = buildTtsRequestBody({
      model: 'mimo-v2.5-tts-voicedesign',
      text: 'Welcome back.',
      stylePrompt: 'Deep and steady male narrator.',
      voice: 'Mia',
    });

    expect(body.audio).toEqual({ format: 'wav' });
    expect(body.messages[0]).toEqual({ role: 'user', content: 'Deep and steady male narrator.' });
  });

  it('音色克隆模型使用上传样本作为 audio.voice', () => {
    const body = buildTtsRequestBody({
      model: 'mimo-v2.5-tts-voiceclone',
      text: 'Yes, I had a sandwich.',
      stylePrompt: '',
      voice: 'mimo_default',
      voiceSampleDataUrl: 'data:audio/mpeg;base64,AAAA',
    });

    expect(body.audio).toEqual({ format: 'wav', voice: 'data:audio/mpeg;base64,AAAA' });
    expect(body.messages).toEqual([
      { role: 'user', content: '' },
      { role: 'assistant', content: 'Yes, I had a sandwich.' },
    ]);
  });

  it('把 MiMo TTS 响应音频转成可播放结果', () => {
    const result = toAudioResult(
      {
        choices: [{ message: { audio: { data: 'UklGRg==', id: 'voice-1' } } }],
      },
      'mimo-v2.5-tts',
    );

    expect(result).toMatchObject({
      src: 'data:audio/wav;base64,UklGRg==',
      mimeType: 'audio/wav',
      filename: 'mimo-v2.5-tts-voice-1.wav',
    });
  });

  it('只接受 MiMo voiceclone 支持的音频样本格式', () => {
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.wav', { type: 'audio/x-wav' }))).toBe('audio/wav');
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.mp3', { type: 'audio/mp3' }))).toBe('audio/mpeg');
    expect(getTtsVoiceSampleMimeType(new File(['x'], 'voice.ogg', { type: 'audio/ogg' }))).toBeNull();
  });
});
