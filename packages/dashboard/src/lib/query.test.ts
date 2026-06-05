import { describe, expect, it } from 'vitest';
import { buildQuery } from './query';

describe('buildQuery', () => {
  it('跳过 undefined / null / 空字符串', () => {
    expect(buildQuery({ a: '1', b: undefined, c: null, d: '' })).toBe('a=1');
  });

  it('保留 0 与 false', () => {
    expect(buildQuery({ page: 0, active: false })).toBe('page=0&active=false');
  });

  it('数字转字符串', () => {
    expect(buildQuery({ pageSize: 20 })).toBe('pageSize=20');
  });

  it('对特殊字符做 URL 编码', () => {
    expect(buildQuery({ email: 'a b@x.com' })).toBe('email=a+b%40x.com');
  });

  it('空对象返回空串', () => {
    expect(buildQuery({})).toBe('');
  });
});
