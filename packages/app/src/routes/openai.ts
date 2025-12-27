import { Hono } from "hono";
import type { CloudflareBindings } from "../types";
import { authMiddleware } from "../middleware/auth";
import { createDb } from "../db";
import { KVService } from "../services/kv-service";
import { OpenAIService, type ChatCompletionRequest } from "../services/openai-service";
import { BillingService } from "../services/billing-service";

const openai = new Hono<{ Bindings: CloudflareBindings }>();

// 应用认证中间件（包含并发控制）
openai.use("/*", authMiddleware);

/**
 * POST /v1/chat/completions
 * OpenAI 兼容的 Chat Completions 接口
 */
openai.post("/chat/completions", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<ChatCompletionRequest>();

  if (!body.model || !body.messages) {
    return c.json(
      { error: { message: "缺少 model 或 messages 参数", type: "invalid_request_error" } },
      400
    );
  }

  const openaiService = new OpenAIService(c.env.OPENAI_API_KEY);
  const db = createDb(c.env.DB);
  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);
  const billingService = new BillingService(kvService, db);

  try {
    if (body.stream) {
      // 流式响应
      const upstreamResponse = await openaiService.chatCompletionStream(body);

      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const reader = upstreamResponse.body?.getReader();

      if (!reader) {
        return c.json({ error: { message: "上游响应无效", type: "api_error" } }, 502);
      }

      // 异步处理流
      const processStream = async () => {
        const decoder = new TextDecoder();
        let buffer = "";
        const model = body.model;
        let inputTokens = 0;
        let outputTokens = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            await writer.write(value);

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.usage) {
                    inputTokens = data.usage.prompt_tokens ?? inputTokens;
                    outputTokens = data.usage.completion_tokens ?? outputTokens;
                  }
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        } finally {
          await writer.close();
        }

        // 异步计费
        if (inputTokens > 0 || outputTokens > 0) {
          await billingService.processUsage(userId, null, {
            model,
            inputTokens,
            outputTokens,
          });
        }
      };

      c.executionCtx.waitUntil(processStream());

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // 非流式响应
    const response = await openaiService.chatCompletion(body);

    // 异步计费
    c.executionCtx.waitUntil(
      billingService.processUsage(userId, null, {
        model: response.model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
      })
    );

    return c.json(response);
  } catch (error) {
    console.error("OpenAI API 调用失败:", error);

    try {
      const upstreamError = JSON.parse(String(error).replace("Error: ", ""));
      return c.json(upstreamError, 502);
    } catch {
      return c.json(
        { error: { message: "上游 API 调用失败", type: "api_error" } },
        502
      );
    }
  }
});

/**
 * GET /v1/models
 * 列出可用模型
 */
openai.get("/models", async (c) => {
  const db = createDb(c.env.DB);
  const modelList = await db.query.models.findMany();

  if (modelList.length === 0) {
    return c.json({
      object: "list",
      data: [
        { id: "gpt-4o", object: "model", owned_by: "openai" },
        { id: "gpt-4o-mini", object: "model", owned_by: "openai" },
        { id: "gpt-4-turbo", object: "model", owned_by: "openai" },
        { id: "gpt-3.5-turbo", object: "model", owned_by: "openai" },
      ],
    });
  }

  return c.json({
    object: "list",
    data: modelList.map((m) => ({
      id: m.id,
      object: "model",
      owned_by: m.provider,
    })),
  });
});

export default openai;
