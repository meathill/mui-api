/**
 * GA4 关键事件封装（Issue #13）
 *
 * 事件定义（命名优先用 GA4 推荐事件，自定义事件保持语义清晰）：
 * - `sign_up`（推荐，参数 method）——注册完成，一次性
 * - `api_key_created`（自定义）——API Key 创建成功，每次创建都发
 * - `playground_first_run`（自定义，参数 mode/model）——Playground 首次成功请求，一次性
 * - `begin_checkout`（推荐，参数 value/currency）——点击充值跳转 Stripe 前
 * - `purchase`（推荐，transaction_id 去重）——充值到账
 *
 * 去重：一次性事件用 localStorage 标记；`purchase` 以 checkout session id 为
 * transaction_id（GA4 后台天然去重），前端再加 localStorage 标记防轮询重复触发。
 *
 * Consent：由 Consent Mode v2 统一控制（默认 denied，横幅 accept 后 granted）。
 * 本模块不做客户端门控——denied 状态下 gtag 只发 cookieless ping，符合预期行为。
 */

import { sendGAEvent } from '@next/third-parties/google';

export const GA_MEASUREMENT_ID = 'G-JLM9L0BTTV';

const SIGN_UP_SENT_KEY = 'mui_ga_signup_sent';
const PENDING_SIGN_UP_KEY = 'mui_ga_pending_signup';
const PLAYGROUND_FIRST_SENT_KEY = 'mui_ga_playground_first_sent';
const PURCHASE_SENT_PREFIX = 'mui_ga_purchase_';
const ANALYTICS_CONSENT_KEY = 'mui_analytics_consent';

export type AnalyticsConsent = 'granted' | 'denied';

export type SignUpMethod = 'email' | 'github' | 'google';
export type PlaygroundMode = 'chat' | 'image' | 'video' | 'tts';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 无痕模式等写入失败时忽略，去重降级为不保证
  }
}

function emit(eventName: string, params?: Record<string, unknown>): void {
  if (!isBrowser()) return;
  try {
    if (params) {
      sendGAEvent('event', eventName, params);
    } else {
      sendGAEvent('event', eventName);
    }
  } catch {
    // GA 未加载或被拦截时静默丢弃，不影响业务流程
  }
}

/**
 * 上报注册完成，一次性。重复调用返回 false 且不再上报。
 */
export function trackSignUp(method: SignUpMethod): boolean {
  if (!isBrowser()) return false;
  if (readLocal(SIGN_UP_SENT_KEY)) return false;
  writeLocal(SIGN_UP_SENT_KEY, method);
  emit('sign_up', { method });
  return true;
}

/**
 * 社交登录是 OAuth 跳转，无法在点击时确认是否注册成功。
 * 点击时先把 method 存入 sessionStorage，/app 首次加载时补发。
 */
export function markPendingSignUp(method: SignUpMethod): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(PENDING_SIGN_UP_KEY, method);
  } catch {
    // 忽略
  }
}

/**
 * 读取并清除待补发的注册标记，无标记返回 null。
 */
export function consumePendingSignUp(): SignUpMethod | null {
  if (!isBrowser()) return null;
  try {
    const value = window.sessionStorage.getItem(PENDING_SIGN_UP_KEY);
    window.sessionStorage.removeItem(PENDING_SIGN_UP_KEY);
    if (value === 'email' || value === 'github' || value === 'google') return value;
    return null;
  } catch {
    return null;
  }
}

/**
 * API Key 创建成功。用户主动行为、天然低频，每次成功创建都上报。
 */
export function trackApiKeyCreated(): void {
  emit('api_key_created');
}

/**
 * Playground 首次成功请求，一次性。重复调用返回 false 且不再上报。
 */
export function trackPlaygroundFirstRun(mode: PlaygroundMode, model?: string): boolean {
  if (!isBrowser()) return false;
  if (readLocal(PLAYGROUND_FIRST_SENT_KEY)) return false;
  writeLocal(PLAYGROUND_FIRST_SENT_KEY, `${mode}:${model ?? ''}`);
  emit('playground_first_run', model ? { mode, model } : { mode });
  return true;
}

/**
 * 点击充值、跳转 Stripe 前上报。
 */
export function trackBeginCheckout(amount: number): void {
  emit('begin_checkout', { currency: 'USD', value: amount });
}

/**
 * 充值到账。同一 checkout session 只上报一次（返回 false 表示已上报过）。
 */
export function trackPurchase(checkoutSessionId: string, amount: number): boolean {
  if (!isBrowser()) return false;
  const key = `${PURCHASE_SENT_PREFIX}${checkoutSessionId}`;
  if (readLocal(key)) return false;
  writeLocal(key, String(amount));
  emit('purchase', { currency: 'USD', transaction_id: checkoutSessionId, value: amount });
  return true;
}

/**
 * 登录后绑定 user_id，把登录前的匿名（Organic 落地）会话与登录后行为连起来。
 * 同一浏览器同一域名下 client_id 本来就一致，这里只是补上 user_id 维度。
 */
export function setAnalyticsUserId(userId: string): void {
  if (!isBrowser()) return;
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.('set', { user_id: userId });
  } catch {
    // 忽略
  }
}

// ==================== Consent Mode v2 ====================

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (!isBrowser()) return null;
  const value = readLocal(ANALYTICS_CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
}

function pushConsentUpdate(state: AnalyticsConsent): void {
  try {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  } catch {
    // 忽略
  }
}

export function grantAnalyticsConsent(): void {
  if (!isBrowser()) return;
  writeLocal(ANALYTICS_CONSENT_KEY, 'granted');
  pushConsentUpdate('granted');
}

export function denyAnalyticsConsent(): void {
  if (!isBrowser()) return;
  writeLocal(ANALYTICS_CONSENT_KEY, 'denied');
  pushConsentUpdate('denied');
}
