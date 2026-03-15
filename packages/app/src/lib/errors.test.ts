import { describe, expect, it } from 'vitest';
import { createErrorResponse, zodErrorToApiError, ErrorTypes } from './errors';
import { z, ZodError } from 'zod';

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
