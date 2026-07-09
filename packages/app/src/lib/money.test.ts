// 实现已上移到 @muirouter/shared-db/money（app 与 dashboard 共用）；
// 测试保留在 app 包运行，因为 shared-db 无独立测试基建。

import { formatBalance, fromCents, toCents } from '@muirouter/shared-db/money';
import { describe, expect, it } from 'vitest';

describe('toCents', () => {
  it('百进位币种按 100 换算并四舍五入', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(12.34, 'USD')).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30); // 浮点误差 0.30000000000000004 应被 round 吸收
    expect(toCents(9.999)).toBe(1000);
  });

  it('零进位币种（JPY/KRW/VND）不乘 100', () => {
    expect(toCents(1234, 'JPY')).toBe(1234);
    expect(toCents(1234.4, 'KRW')).toBe(1234);
    expect(toCents(1234.5, 'VND')).toBe(1235);
  });

  it('币种码大小写不敏感', () => {
    expect(toCents(10, 'jpy')).toBe(10);
    expect(toCents(10, 'usd')).toBe(1000);
  });

  it('空值与 NaN 兜底为 0', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(Number.NaN)).toBe(0);
    expect(toCents(undefined as unknown as number)).toBe(0);
  });

  it('负数金额保持符号', () => {
    expect(toCents(-1.5)).toBe(-150);
  });
});

describe('fromCents', () => {
  it('百进位币种除以 100', () => {
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(1234, 'USD')).toBe(12.34);
  });

  it('零进位币种原样返回', () => {
    expect(fromCents(1234, 'JPY')).toBe(1234);
  });

  it('与 toCents 互为逆运算（整数分）', () => {
    expect(fromCents(toCents(56.78))).toBe(56.78);
    expect(toCents(fromCents(999))).toBe(999);
  });
});

describe('formatBalance', () => {
  it('百进位币种固定两位小数', () => {
    expect(formatBalance(12.3)).toBe('12.30');
    expect(formatBalance(0)).toBe('0.00');
    expect(formatBalance(1234.567)).toBe('1234.57');
  });

  it('零进位币种取整无小数', () => {
    expect(formatBalance(1234.6, 'JPY')).toBe('1235');
    expect(formatBalance(1234, 'krw')).toBe('1234');
  });

  it('空值与 NaN 兜底为 0', () => {
    expect(formatBalance(Number.NaN)).toBe('0.00');
    expect(formatBalance(undefined as unknown as number)).toBe('0.00');
    expect(formatBalance(Number.NaN, 'JPY')).toBe('0');
  });
});
