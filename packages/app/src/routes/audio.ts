import { audioModelRates } from '@muirouter/shared-db/business';
import { resolveModelId } from '@muirouter/shared-db/integration';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { synthesizeAudio, transcribeAudio } from '../services/audio-provider';
import { getGlobalModelDefaults } from '../services/control-configuration';
import { createProxyServices, type ProxyServices } from '../services/service-factory';
import type { CloudflareBindings } from '../types';
import {
  assertBillableAccess,
  isResponse,
  lookupModel,
  type OpenAIContext,
  type ModelLookup,
  processBilling,
} from './openai-helpers';

const audio = new Hono<{ Bindings: CloudflareBindings }>();
const speechSchema = z.object({
  model: z.string().optional(),
  input: z.string().min(1).max(12000),
  voice: z.string().min(1).max(100).default('mimo_default'),
  instructions: z.string().max(2000).optional(),
  response_format: z.enum(['wav', 'mp3']).default('wav'),
});
audio.use('/audio/*', bodyLimit({ maxSize: 26 * 1024 * 1024 }));
audio.use('/audio/*', authMiddleware);

async function rateFor(c: OpenAIContext, services: ProxyServices, lookup: ModelLookup) {
  const rate = await services.db
    .select()
    .from(audioModelRates)
    .where(eq(audioModelRates.modelId, lookup.modelConfig.id))
    .get();
  const hasTokenPricing =
    lookup.upstreamModel.startsWith('mimo-') &&
    lookup.modelConfig.inputPrice !== null &&
    lookup.modelConfig.outputPrice !== null;
  if (!rate && !hasTokenPricing && c.get('executionPolicy')?.billingMode !== 'meter_only')
    return c.json({ error: 'audio_pricing_missing', message: '此模型尚未配置可用于钱包扣款的音频费率' }, 503);
  return rate;
}

async function recordAudio(
  c: OpenAIContext,
  services: ProxyServices,
  lookup: ModelLookup,
  units: number | null,
  rate: Awaited<ReturnType<typeof rateFor>>,
  usage?: Record<string, unknown> | null,
) {
  if (rate && !isResponse(rate) && units !== null) {
    const result = await services.billingService.processFixedCost(
      c.get('userId'),
      c.get('apiKeyId'),
      lookup.modelConfig.id,
      units * rate.pricePerUnit,
      lookup.modelPricing,
      c.get('rateMultiplier'),
    );
    if (c.get('executionPolicy')?.billingMode !== 'meter_only')
      await services.alertService.checkAfterBilling(c.get('userId'), result.totalCost);
  } else if (usage && lookup.modelConfig.inputPrice !== null && lookup.modelConfig.outputPrice !== null) {
    await processBilling(
      c,
      services,
      'openai',
      Response.json({ model: lookup.modelConfig.id, usage }),
      lookup.modelConfig.id,
      lookup.modelPricing,
    );
  } else await services.billingService.logMissingUsage(c.get('userId'), c.get('apiKeyId'), lookup.modelConfig.id);
}

audio.post('/audio/speech', async (c) => {
  try {
    const input = speechSchema.parse(await c.req.json());
    const model = resolveModelId(
      input.model,
      'tts',
      c.get('executionPolicy')?.defaults,
      await getGlobalModelDefaults(c.get('db')),
    );
    const services = createProxyServices(c.env, c.get('db'), c.get('executionPolicy'));
    const lookup = await lookupModel(c, model, services);
    if (isResponse(lookup)) return lookup;
    if (!/tts|speech/.test(lookup.upstreamModel)) return c.json({ error: 'unsupported_model' }, 400);
    const denied = await assertBillableAccess(c, services, model);
    if (denied) return denied;
    const rate = await rateFor(c, services, lookup);
    if (isResponse(rate)) return rate;
    if (rate && rate.unit !== 'character') return c.json({ error: 'unsupported_audio_rate' }, 503);
    const result = await synthesizeAudio(c.env, lookup.modelConfig.provider, lookup.connection, {
      ...input,
      model: lookup.upstreamModel,
    });
    c.executionCtx.waitUntil(recordAudio(c, services, lookup, Array.from(input.input).length, rate, result.usage));
    return result.response;
  } catch (error) {
    if (error instanceof z.ZodError) return c.json({ error: 'invalid_input', issues: error.issues }, 400);
    return c.json({ error: 'speech_failed', message: error instanceof Error ? error.message : '语音合成失败' }, 502);
  }
});

audio.post('/audio/transcriptions', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 25 * 1024 * 1024)
      return c.json({ error: 'invalid_audio_file' }, 400);
    const model = resolveModelId(
      form.get('model'),
      'stt',
      c.get('executionPolicy')?.defaults,
      await getGlobalModelDefaults(c.get('db')),
    );
    const services = createProxyServices(c.env, c.get('db'), c.get('executionPolicy'));
    const lookup = await lookupModel(c, model, services);
    if (isResponse(lookup)) return lookup;
    const denied = await assertBillableAccess(c, services, model);
    if (denied) return denied;
    const rate = await rateFor(c, services, lookup);
    if (isResponse(rate)) return rate;
    if (rate && rate.unit !== 'second') return c.json({ error: 'unsupported_audio_rate' }, 503);
    const language = form.get('language');
    const result = await transcribeAudio(
      c.env,
      lookup.upstreamModel,
      lookup.modelConfig.provider,
      lookup.connection,
      file,
      typeof language === 'string' ? language : undefined,
    );
    if (!result.text?.trim()) throw new Error('上游未返回有效转写');
    const duration =
      typeof result.duration === 'number' && Number.isFinite(result.duration) && result.duration > 0
        ? result.duration
        : null;
    if (rate && duration === null && c.get('executionPolicy')?.billingMode !== 'meter_only')
      return c.json({ error: 'audio_duration_missing' }, 502);
    c.executionCtx.waitUntil(recordAudio(c, services, lookup, duration, rate, result.usage));
    return c.json({ ...result, duration });
  } catch (error) {
    return c.json({ error: 'transcription_failed', message: error instanceof Error ? error.message : '转写失败' }, 502);
  }
});

export default audio;
