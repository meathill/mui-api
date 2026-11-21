// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAnalyticsQueue, setCustomTag, trackEvent } from './analytics';

/**
 * analytics.ts 的待发队列是模块级状态且跨用例共享，jsdom 的 window 也是。
 * beforeEach 里先挂一个一次性 clarity 函数把上个用例可能残留的队列清空，
 * 再删掉所有全局桩，保证每个用例都从"Clarity/GA4 未加载"的初始状态开始。
 */
beforeEach(() => {
  window.clarity = vi.fn();
  flushAnalyticsQueue();
  delete window.clarity;
  delete window.gtag;
  delete window.dataLayer;
});

describe('analytics 埋点封装', () => {
  it('Clarity 未就绪时事件进入待发队列，flush 后按序补发', () => {
    trackEvent('topup_cancelled');
    setCustomTag('topup_amount', '10');

    // 队列存在闭包里，外部唯一可见效果是 flush 后的调用顺序
    const clarity = vi.fn();
    window.clarity = clarity;
    flushAnalyticsQueue();

    expect(clarity).toHaveBeenNthCalledWith(1, 'event', 'topup_cancelled');
    expect(clarity).toHaveBeenNthCalledWith(2, 'set', 'topup_amount', '10');
  });

  it('flush 后再次 flush 不会重复补发', () => {
    trackEvent('topup_checkout_started');
    const clarity = vi.fn();
    window.clarity = clarity;
    flushAnalyticsQueue();
    flushAnalyticsQueue();

    expect(clarity).toHaveBeenCalledTimes(1);
  });

  it('Clarity 已就绪时直接调用、不入队', () => {
    const clarity = vi.fn();
    window.clarity = clarity;
    trackEvent('topup_completed');
    flushAnalyticsQueue();

    expect(clarity).toHaveBeenCalledExactlyOnceWith('event', 'topup_completed');
  });

  it('DeferredClarity 尚未注入时 flush 是安全的空操作', () => {
    expect(() => flushAnalyticsQueue()).not.toThrow();
  });

  it('GA4 走官方 gtag stub 模式：dataLayer 暂存参数，gtag.js 加载后可重放', () => {
    trackEvent('topup_checkout_started', { amount: 10 });

    // stub 把 ('event', name, props) 压入 dataLayer，gtag.js 加载后重放
    expect(window.dataLayer?.[0]).toMatchObject({ 0: 'event', 1: 'topup_checkout_started' });
    expect(window.gtag).toBeTypeOf('function');
  });

  it('gtag 已存在时（GA 已加载）直接透传调用', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent('topup_completed', { amount: 20 });

    expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'topup_completed', { amount: 20 });
    // 不应覆盖已存在的 gtag，dataLayer 保持空数组
    expect(window.dataLayer).toEqual([]);
  });
});
