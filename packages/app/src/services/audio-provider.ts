import { Buffer } from 'node:buffer';
import type { CloudflareBindings } from '../types';
import { callConfiguredEndpoint, type ProviderConnection } from './provider-connection';
import { callOpenAIEndpoint, xiaomiMiMoBaseURL } from './provider-dispatch';

export interface SpeechInput {
  model: string;
  input: string;
  voice: string;
  instructions?: string;
  response_format: 'wav' | 'mp3';
}
export interface SpeechOutput {
  response: Response;
  usage: Record<string, unknown> | null;
}

export async function synthesizeAudio(
  env: CloudflareBindings,
  provider: string,
  connection: ProviderConnection | null,
  input: SpeechInput,
): Promise<SpeechOutput> {
  if (input.model.startsWith('mimo-')) {
    if (input.response_format !== 'wav') throw new Error('MiMo 语音输出目前只支持 wav');
    const body = JSON.stringify({
      model: input.model,
      messages: [
        ...(input.instructions ? [{ role: 'user', content: input.instructions }] : []),
        { role: 'assistant', content: input.input },
      ],
      audio: { voice: input.voice, format: 'wav' },
      stream: false,
    });
    if (!connection && !env.MIMO_API_KEY) throw new Error('MiMo TTS 凭证未安装');
    const response = connection
      ? await callConfiguredEndpoint(env, connection, '/chat/completions', body, 'application/json')
      : await fetch(`${xiaomiMiMoBaseURL(env)}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.MIMO_API_KEY}`, 'content-type': 'application/json' },
          body,
          redirect: 'error',
        });
    if (!response.ok) throw new Error(`TTS 上游 HTTP ${response.status}`);
    const data = (await response.json()) as {
      choices?: Array<{ message?: { audio?: { data?: string } } }>;
      usage?: Record<string, unknown>;
    };
    const audio = data.choices?.[0]?.message?.audio?.data;
    if (!audio) throw new Error('TTS 上游未返回音频');
    return {
      response: new Response(Buffer.from(audio, 'base64'), { headers: { 'content-type': 'audio/wav' } }),
      usage: data.usage ?? null,
    };
  }
  if (provider !== 'openai' && connection?.protocol !== 'openai') throw new Error('模型不支持 speech 协议');
  const response = connection
    ? await callConfiguredEndpoint(env, connection, '/audio/speech', JSON.stringify(input), 'application/json')
    : await callOpenAIEndpoint(env, '/audio/speech', JSON.stringify(input), { 'content-type': 'application/json' });
  if (!response.ok) throw new Error(`TTS 上游 HTTP ${response.status}`);
  return { response, usage: null };
}

export interface TranscriptionOutput {
  text: string;
  duration: number | null;
  language: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  usage?: Record<string, unknown>;
}
export async function transcribeAudio(
  env: CloudflareBindings,
  model: string,
  provider: string,
  connection: ProviderConnection | null,
  file: File,
  language?: string,
): Promise<TranscriptionOutput> {
  if (model === '@cf/openai/whisper-large-v3-turbo') {
    const audio = Buffer.from(await file.arrayBuffer()).toString('base64');
    const data = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
      audio,
      vad_filter: true,
      ...(language ? { language } : {}),
    });
    return {
      text: data.text ?? '',
      duration: data.transcription_info?.duration ?? null,
      language: data.transcription_info?.language ?? language ?? 'unknown',
      segments: data.segments?.map((segment) => ({
        start: segment.start ?? 0,
        end: segment.end ?? 0,
        text: segment.text ?? '',
      })),
    };
  }
  if (model.startsWith('mimo-')) {
    if (!connection && !env.MIMO_API_KEY) throw new Error('MiMo ASR 凭证未安装');
    const body = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`,
              },
            },
          ],
        },
      ],
      asr_options: { language: language ?? 'auto' },
    });
    const response = connection
      ? await callConfiguredEndpoint(env, connection, '/chat/completions', body, 'application/json')
      : await fetch(`${xiaomiMiMoBaseURL(env)}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.MIMO_API_KEY}`, 'content-type': 'application/json' },
          body,
          redirect: 'error',
        });
    if (!response.ok) throw new Error(`ASR 上游 HTTP ${response.status}`);
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, unknown>;
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      language: language ?? 'unknown',
      duration: null,
      usage: data.usage,
    };
  }
  if (provider !== 'openai' && connection?.protocol !== 'openai') throw new Error('模型不支持 transcription 协议');
  const form = new FormData();
  form.set('file', file);
  form.set('model', model);
  form.set('response_format', 'verbose_json');
  if (language) form.set('language', language);
  const response = connection
    ? await callConfiguredEndpoint(env, connection, '/audio/transcriptions', form)
    : await callOpenAIEndpoint(env, '/audio/transcriptions', form);
  if (!response.ok) throw new Error(`ASR 上游 HTTP ${response.status}`);
  return response.json() as Promise<TranscriptionOutput>;
}
