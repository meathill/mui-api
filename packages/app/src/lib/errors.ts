import type { Context } from "hono";
import type { ZodError } from "zod";

/**
 * 统一的 API 错误响应格式
 */
export interface ApiError {
  error: {
    message: string;
    type: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * 创建标准化错误响应
 */
export function createErrorResponse(
  message: string,
  type: string,
  code?: string,
  details?: unknown
): ApiError {
  return {
    error: {
      message,
      type,
      ...(code && { code }),
      ...(details && { details }),
    },
  };
}

/**
 * 将 Zod 错误转换为 API 错误
 */
export function zodErrorToApiError(error: ZodError): ApiError {
  const firstError = error.errors[0];
  const path = firstError?.path.join(".") || "";
  const message = firstError?.message || "验证失败";

  return createErrorResponse(
    path ? `${path}: ${message}` : message,
    "invalid_request_error",
    "validation_error",
    error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }))
  );
}

/**
 * 常用错误类型
 */
export const ErrorTypes = {
  INVALID_REQUEST: "invalid_request_error",
  INVALID_API_KEY: "invalid_api_key",
  INSUFFICIENT_QUOTA: "insufficient_quota",
  RATE_LIMIT: "rate_limit_exceeded",
  API_ERROR: "api_error",
  NOT_FOUND: "not_found",
  INTERNAL_ERROR: "internal_error",
} as const;

/**
 * 错误响应辅助函数
 */
export function badRequest(c: Context, message: string, details?: unknown) {
  return c.json(
    createErrorResponse(message, ErrorTypes.INVALID_REQUEST, undefined, details),
    400
  );
}

export function unauthorized(c: Context, message: string = "未授权") {
  return c.json(createErrorResponse(message, ErrorTypes.INVALID_API_KEY), 401);
}

export function forbidden(c: Context, message: string = "禁止访问") {
  return c.json(createErrorResponse(message, ErrorTypes.INVALID_API_KEY), 403);
}

export function notFound(c: Context, message: string = "资源不存在") {
  return c.json(createErrorResponse(message, ErrorTypes.NOT_FOUND), 404);
}

export function tooManyRequests(c: Context, message: string) {
  return c.json(createErrorResponse(message, ErrorTypes.RATE_LIMIT), 429);
}

export function internalError(c: Context, message: string = "内部错误", details?: unknown) {
  return c.json(
    createErrorResponse(message, ErrorTypes.INTERNAL_ERROR, undefined, details),
    500
  );
}

export function gatewayError(c: Context, message: string, details?: unknown) {
  return c.json(
    createErrorResponse(message, ErrorTypes.API_ERROR, undefined, details),
    502
  );
}
