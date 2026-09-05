// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendGAEventMock = vi.fn();

vi.mock('@next/third-parties/google', () => ({
  sendGAEvent: (...args: unknown[]) => sendGAEventMock(...args),
}));

import {
  consumePendingSignUp,
  markPendingSignUp,
  setAnalyticsUserId,
  trackApiKeyCreated,
  trackBeginCheckout,
  trackPlaygroundFirstRun,
  trackPurchase,
  trackSignUp,
} from './analytics';

beforeEach(() => {
  sendGAEventMock.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

function installMemoryStorage() {
  function makeStorage(): Storage {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }
  // 当前 jsdom 版本默认不提供 localStorage/sessionStorage，这里注入内存实现。
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: makeStorage(),
    writable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: makeStorage(),
    writable: true,
  });
}

installMemoryStorage();

describe('analytics 关键事件', () => {
  it('sign_up 只上报一次，重复调用直接返回 false', () => {
    expect(trackSignUp('email')).toBe(true);
    expect(trackSignUp('email')).toBe(false);
    expect(sendGAEventMock).toHaveBeenCalledTimes(1);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'sign_up', { method: 'email' });
  });

  it('社交登录的待补发标记可写入、读取一次后清除', () => {
    markPendingSignUp('github');
    expect(consumePendingSignUp()).toBe('github');
    expect(consumePendingSignUp()).toBeNull();
  });

  it('非法待补发标记返回 null 且同样清除', () => {
    window.sessionStorage.setItem('mui_ga_pending_signup', 'wechat');
    expect(consumePendingSignUp()).toBeNull();
    expect(window.sessionStorage.getItem('mui_ga_pending_signup')).toBeNull();
  });

  it('api_key_created 每次调用都上报（天然低频，不做一次性去重）', () => {
    trackApiKeyCreated();
    trackApiKeyCreated();
    expect(sendGAEventMock).toHaveBeenCalledTimes(2);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'api_key_created');
  });

  it('playground_first_run 只上报一次并携带 mode/model', () => {
    expect(trackPlaygroundFirstRun('chat', 'gpt-4o')).toBe(true);
    expect(trackPlaygroundFirstRun('image')).toBe(false);
    expect(sendGAEventMock).toHaveBeenCalledTimes(1);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'playground_first_run', {
      mode: 'chat',
      model: 'gpt-4o',
    });
  });

  it('begin_checkout 每次点击都上报', () => {
    trackBeginCheckout(20);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'begin_checkout', {
      currency: 'USD',
      value: 20,
    });
  });

  it('purchase 同一 checkout session 只上报一次，transaction_id 天然去重', () => {
    expect(trackPurchase('cs_test_123', 20)).toBe(true);
    expect(trackPurchase('cs_test_123', 20)).toBe(false);
    expect(trackPurchase('cs_test_456', 50)).toBe(true);
    expect(sendGAEventMock).toHaveBeenCalledTimes(2);
    expect(sendGAEventMock).toHaveBeenCalledWith('event', 'purchase', {
      currency: 'USD',
      transaction_id: 'cs_test_123',
      value: 20,
    });
  });

  it('setAnalyticsUserId 通过 gtag 绑定 user_id', () => {
    const gtagMock = vi.fn();
    (window as unknown as { gtag: unknown }).gtag = gtagMock;
    setAnalyticsUserId('user_123');
    expect(gtagMock).toHaveBeenCalledWith('set', { user_id: 'user_123' });
    delete (window as unknown as { gtag?: unknown }).gtag;
  });

  it('gtag 缺失时 setAnalyticsUserId 不抛错', () => {
    expect(() => setAnalyticsUserId('user_123')).not.toThrow();
  });
});
