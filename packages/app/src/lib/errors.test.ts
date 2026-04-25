import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import {
  badRequest,
  createErrorResponse,
  ErrorTypes,
  forbidden,
  gatewayError,
  internalError,
  notFound,
  tooManyRequests,
  unauthorized,
  zodErrorToApiError,
} from './errors';

describe('createErrorResponse', () => {
  it('创建基本错误响应', () => {
    const result = createErrorResponse('出错了', 'api_error');
    expect(result).toEqual({
      error: {
        message: '出错了',
        type: 'api_error',
      },
    });
  });

  it('包含可选的 code 和 details', () => {
    const result = createErrorResponse('验证失败', 'invalid_request_error', 'validation_error', { field: 'email' });
    expect(result.error.code).toBe('validation_error');
    expect(result.error.details).toEqual({ field: 'email' });
  });

  it('省略 falsy 的 code 和 details', () => {
    const result = createErrorResponse('msg', 'type', '', undefined);
    expect(result.error).not.toHaveProperty('code');
    expect(result.error).not.toHaveProperty('details');
  });
});

describe('zodErrorToApiError', () => {
  it('转换 Zod 验证错误', () => {
    // 手动构造 ZodError 以确保兼容 Zod v4
    const issues = [
      { path: ['email'], message: 'Invalid email', code: 'invalid_string' as const, validation: 'email' as const },
    ];
    const error = new ZodError(issues as never);

    const result = zodErrorToApiError(error);
    expect(result.error.type).toBe('invalid_request_error');
    expect(result.error.code).toBe('validation_error');
    expect(result.error.message).toContain('email');
    expect(Array.isArray(result.error.details)).toBe(true);
  });

  it('处理无 issue 时的降级', () => {
    const error = new ZodError([]);
    const result = zodErrorToApiError(error);
    expect(result.error.message).toBe('验证失败');
  });

  it('处理嵌套路径', () => {
    const issues = [
      {
        path: ['nested', 'value'],
        message: 'Expected number',
        code: 'invalid_type' as const,
        expected: 'number',
        received: 'string',
      },
    ];
    const error = new ZodError(issues as never);

    const result = zodErrorToApiError(error);
    expect(result.error.message).toContain('nested.value');
  });
});

describe('ErrorTypes', () => {
  it('包含所有预期错误类型', () => {
    expect(ErrorTypes.INVALID_REQUEST).toBe('invalid_request_error');
    expect(ErrorTypes.INVALID_API_KEY).toBe('invalid_api_key');
    expect(ErrorTypes.INSUFFICIENT_QUOTA).toBe('insufficient_quota');
    expect(ErrorTypes.RATE_LIMIT).toBe('rate_limit_exceeded');
    expect(ErrorTypes.API_ERROR).toBe('api_error');
    expect(ErrorTypes.NOT_FOUND).toBe('not_found');
    expect(ErrorTypes.INTERNAL_ERROR).toBe('internal_error');
  });
});

describe('HTTP Error Helpers', () => {
  const mockContext = {
    json: vi.fn((body: any, status: number) => ({ body, status })),
  } as unknown as Context;

  it('badRequest', () => {
    const res = badRequest(mockContext, 'bad req', { foo: 'bar' }) as any;
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('bad req');
    expect(res.body.error.details).toEqual({ foo: 'bar' });
  });

  it('unauthorized', () => {
    const res1 = unauthorized(mockContext) as any;
    expect(res1.status).toBe(401);
    expect(res1.body.error.message).toBe('未授权');

    const res2 = unauthorized(mockContext, 'custom auth error') as any;
    expect(res2.body.error.message).toBe('custom auth error');
  });

  it('forbidden', () => {
    const res1 = forbidden(mockContext) as any;
    expect(res1.status).toBe(403);
    expect(res1.body.error.message).toBe('禁止访问');

    const res2 = forbidden(mockContext, 'custom forbidden') as any;
    expect(res2.body.error.message).toBe('custom forbidden');
  });

  it('notFound', () => {
    const res1 = notFound(mockContext) as any;
    expect(res1.status).toBe(404);
    expect(res1.body.error.message).toBe('资源不存在');

    const res2 = notFound(mockContext, 'custom not found') as any;
    expect(res2.body.error.message).toBe('custom not found');
  });

  it('tooManyRequests', () => {
    const res = tooManyRequests(mockContext, 'rate limit') as any;
    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe('rate limit');
  });

  it('internalError', () => {
    const res1 = internalError(mockContext) as any;
    expect(res1.status).toBe(500);
    expect(res1.body.error.message).toBe('内部错误');

    const res2 = internalError(mockContext, 'custom internal', { debug: 1 }) as any;
    expect(res2.body.error.message).toBe('custom internal');
    expect(res2.body.error.details).toEqual({ debug: 1 });
  });

  it('gatewayError', () => {
    const res = gatewayError(mockContext, 'gateway failed', { reason: 'timeout' }) as any;
    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe('gateway failed');
    expect(res.body.error.details).toEqual({ reason: 'timeout' });
  });
});
