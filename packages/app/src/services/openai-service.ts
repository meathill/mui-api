export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: UsageStats;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI API 服务
 */
export class OpenAIService {
  private baseUrl = "https://api.openai.com/v1";

  constructor(private apiKey: string) { }

  /**
   * 调用 Chat Completions API（非流式）
   */
  async chatCompletion(
    body: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...body, stream: false }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    return response.json();
  }

  /**
   * 调用 Chat Completions API（流式）
   * 返回原始 Response 用于透传
   */
  async chatCompletionStream(
    body: ChatCompletionRequest
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(JSON.stringify(error));
    }

    return response;
  }

  /**
   * 从流式响应中提取 usage 信息
   * 注意：OpenAI 流式响应最后会包含 usage 字段
   */
  async extractStreamUsage(
    response: Response
  ): Promise<{ inputTokens: number; outputTokens: number; model: string } | null> {
    const reader = response.body?.getReader();
    if (!reader) return null;

    const decoder = new TextDecoder();
    let buffer = "";
    let model = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.model) model = data.model;
              if (data.usage) {
                inputTokens = data.usage.prompt_tokens ?? 0;
                outputTokens = data.usage.completion_tokens ?? 0;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return model ? { model, inputTokens, outputTokens } : null;
  }
}
