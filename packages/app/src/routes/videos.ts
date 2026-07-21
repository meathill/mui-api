import { calculateGrokVideoInternalTokens, isGrokVideoModelId } from '@muirouter/shared-db/grok-video';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { badRequest, createErrorResponse, ErrorTypes, gatewayError, notFound, upstreamError } from '../lib/errors';
import { parseGrokVideoGenerationRequest } from '../lib/grok-video';
import { paidAuthMiddleware } from '../middleware/auth';
import { usageLogs, videoGenerationJobs } from '../db/schema';
import { callGrokEndpoint } from '../services/provider-dispatch';
import { createProxyServices } from '../services/service-factory';
import { WalletServiceError } from '../services/wallet-service';
import type { CloudflareBindings } from '../types';
import { isResponse, lookupModel, readJsonBody } from './openai-helpers';

const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;
const videos = new Hono<{ Bindings: CloudflareBindings }>();

videos.post('/videos/generations', paidAuthMiddleware, async (c) => {
  const body = await readJsonBody(c);
  if (isResponse(body)) return body;
  if (typeof body.model !== 'string' || !body.model) return badRequest(c, '缺少 model 参数');

  const services = createProxyServices(c.env, c.get('db'));
  const lookup = await lookupModel(c, body.model, services);
  if (isResponse(lookup)) return lookup;
  if (lookup.modelConfig.provider !== 'grok' || !isGrokVideoModelId(lookup.upstreamModel)) {
    return badRequest(c, '视频生成接口仅支持 Grok Video 模型');
  }
  const parsed = parseGrokVideoGenerationRequest(body, lookup.upstreamModel);
  if ('error' in parsed) return badRequest(c, parsed.error);

  const internalTokens = calculateGrokVideoInternalTokens({
    model: parsed.body.model,
    duration: parsed.body.duration,
    resolution: parsed.body.resolution,
    hasImage: parsed.hasImage,
  });
  const estimatedCost = services.billingService.calculateCost(
    {
      model: body.model,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: internalTokens,
    },
    lookup.modelPricing,
    c.get('rateMultiplier'),
  ).cost;
  const reservationId = crypto.randomUUID();
  const userId = c.get('userId');

  try {
    await services.walletService.reserve(userId, reservationId, estimatedCost, Date.now() + RESERVATION_TTL_MS);
  } catch (error) {
    if (error instanceof WalletServiceError && error.status === 402) {
      return c.json(createErrorResponse('余额不足，无法预占视频生成费用', ErrorTypes.INSUFFICIENT_QUOTA), 402);
    }
    throw error;
  }

  try {
    const upstream = await callGrokEndpoint(c.env, '/v1/videos/generations', JSON.stringify(parsed.body), {
      'content-type': 'application/json',
    });
    if (!upstream.ok) {
      await services.walletService.releaseReservation(userId, reservationId);
      return upstreamError(c, upstream.status, `上游 grok-video 错误 (${upstream.status}): ${await upstream.text()}`);
    }
    const data = (await upstream.json()) as Record<string, unknown>;
    if (typeof data.request_id !== 'string' || !data.request_id) {
      await services.walletService.releaseReservation(userId, reservationId);
      return gatewayError(c, '上游未返回有效 request_id');
    }

    await services.db.insert(videoGenerationJobs).values({
      requestId: data.request_id,
      reservationId,
      userId,
      apiKeyId: c.get('apiKeyId'),
      modelId: body.model,
      duration: parsed.body.duration,
      resolution: parsed.body.resolution,
      estimatedCost,
      markupRate: lookup.modelPricing.markupRate,
      rateMultiplier: c.get('rateMultiplier'),
      status: 'pending',
    });
    return c.json(data);
  } catch (error) {
    await services.walletService.releaseReservation(userId, reservationId).catch(() => undefined);
    console.error('[grok/videos/generations] 调用失败:', error);
    return gatewayError(c, error instanceof Error ? error.message : '视频生成提交失败');
  }
});

videos.get('/videos/:requestId', paidAuthMiddleware, async (c) => {
  const requestId = c.req.param('requestId');
  if (!requestId) return notFound(c, '视频任务不存在');
  const services = createProxyServices(c.env, c.get('db'));
  const job = await services.db.query.videoGenerationJobs.findFirst({
    where: and(eq(videoGenerationJobs.requestId, requestId), eq(videoGenerationJobs.userId, c.get('userId'))),
  });
  if (!job) return notFound(c, '视频任务不存在');

  try {
    const upstream = await callGrokEndpoint(c.env, `/v1/videos/${encodeURIComponent(requestId)}`, undefined, {}, 'GET');
    if (!upstream.ok)
      return upstreamError(c, upstream.status, `上游 grok-video 错误 (${upstream.status}): ${await upstream.text()}`);
    const data = (await upstream.json()) as Record<string, unknown>;
    const status = data.status;
    if (status !== 'pending' && status !== 'done' && status !== 'failed' && status !== 'expired') {
      return gatewayError(c, '上游返回了未知视频任务状态');
    }

    if (status === 'pending') {
      await Promise.all([
        services.walletService.refreshReservation(c.get('userId'), job.reservationId, Date.now() + RESERVATION_TTL_MS),
        services.db
          .update(videoGenerationJobs)
          .set({ status, updatedAt: new Date() })
          .where(eq(videoGenerationJobs.requestId, requestId)),
      ]);
      return c.json(data);
    }

    if (status === 'failed' || status === 'expired') {
      await Promise.all([
        services.walletService.releaseReservation(c.get('userId'), job.reservationId),
        services.db
          .update(videoGenerationJobs)
          .set({ status, updatedAt: new Date() })
          .where(eq(videoGenerationJobs.requestId, requestId)),
      ]);
      return c.json(data);
    }

    if (!job.billedAt) {
      const usage = data.usage as { cost_in_usd_ticks?: unknown } | undefined;
      const ticks = typeof usage?.cost_in_usd_ticks === 'number' ? usage.cost_in_usd_ticks : undefined;
      const internalTokens =
        ticks === undefined
          ? Math.round((job.estimatedCost / job.markupRate / job.rateMultiplier) * 1_000_000)
          : calculateGrokVideoInternalTokens({
              model: job.modelId as Parameters<typeof calculateGrokVideoInternalTokens>[0]['model'],
              duration: job.duration,
              resolution: job.resolution as Parameters<typeof calculateGrokVideoInternalTokens>[0]['resolution'],
              costInUsdTicks: ticks,
            });
      const actualCost =
        ticks === undefined
          ? job.estimatedCost
          : services.billingService.calculateCost(
              {
                model: job.modelId,
                inputTokens: 0,
                cachedInputTokens: 0,
                cacheWriteTokens: 0,
                outputTokens: internalTokens,
              },
              { inputPrice: 0, outputPrice: 1, markupRate: job.markupRate },
              job.rateMultiplier,
            ).cost;
      const settledCost = Math.min(actualCost, job.estimatedCost);
      const reservation = await services.walletService.settleReservation(
        c.get('userId'),
        job.reservationId,
        settledCost,
      );
      if (reservation.status !== 'settled') return gatewayError(c, '视频任务预占已失效，无法完成结算');

      await services.db
        .insert(usageLogs)
        .values({
          id: `video:${requestId}`,
          userId: job.userId,
          apiKeyId: job.apiKeyId,
          modelId: job.modelId,
          inputTokens: 0,
          outputTokens: internalTokens,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          tier: 'standard',
          cost: actualCost,
        })
        .onConflictDoNothing();

      const updated = await services.db
        .update(videoGenerationJobs)
        .set({ status, actualCost, settledCost, billedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(videoGenerationJobs.requestId, requestId), isNull(videoGenerationJobs.billedAt)))
        .returning({ requestId: videoGenerationJobs.requestId });
      if (updated.length > 0) await services.alertService.checkAfterBilling(job.userId, actualCost);
    }
    return c.json(data);
  } catch (error) {
    console.error('[grok/videos/:requestId] 轮询失败:', error);
    return gatewayError(c, error instanceof Error ? error.message : '视频任务查询失败');
  }
});

export default videos;
