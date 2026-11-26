import { describe, expect, it } from 'vitest';
import { getAuthEmailDefaultName, hasAuthEmailAlias, normalizeAuthEmail } from './auth-email';

describe('normalizeAuthEmail', () => {
  it('将 + 别名归一化为主邮箱', () => {
    expect(normalizeAuthEmail('abc+news@Example.com')).toBe('abc@example.com');
    expect(normalizeAuthEmail('abc+one+two@example.com')).toBe('abc@example.com');
    expect(normalizeAuthEmail(' ABC+Tag@EXAMPLE.COM ')).toBe('abc@example.com');
  });

  it('保留普通邮箱和不属于本策略的点号', () => {
    expect(normalizeAuthEmail('abc@example.com')).toBe('abc@example.com');
    expect(normalizeAuthEmail('a.bc+tag@gmail.com')).toBe('a.bc@gmail.com');
  });

  it('将空别名本地部分归一化为无效邮箱，交给 schema 拒绝', () => {
    expect(normalizeAuthEmail('+tag@example.com')).toBe('@example.com');
  });
});

describe('hasAuthEmailAlias', () => {
  it('只识别本地部分的 +', () => {
    expect(hasAuthEmailAlias('abc+tag@example.com')).toBe(true);
    expect(hasAuthEmailAlias('abc@example.com')).toBe(false);
    expect(hasAuthEmailAlias('abc@example+tag.com')).toBe(false);
  });
});

describe('getAuthEmailDefaultName', () => {
  it('使用归一化后的本地部分作为默认昵称', () => {
    expect(getAuthEmailDefaultName('abc+tag@example.com')).toBe('abc');
  });
});
