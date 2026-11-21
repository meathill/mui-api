/**
 * 前端埋点统一入口（issue #23：充值漏斗可度量）。
 *
 * Clarity 脚本由 DeferredClarity 推迟到 window.load 之后注入，而漏斗关键事件
 * （如从 Stripe 返回时的 topup_cancelled）在 hydration 阶段就会触发，直接调
 * window.clarity 会因脚本未就绪而丢失。因此这里维护一个待发队列，等
 * DeferredClarity 的 Script onReady 后统一 flush。
 *
 * GA4 走官方 gtag stub 模式：dataLayer 是普通数组队列，gtag.js 加载后会重放
 * 历史消息，天然支持"先埋点后加载"，无需额外 flush。
 */

type ClarityFn = (action: string, ...args: unknown[]) => void;

/** Clarity 调用入参：首参固定为 action（event / set / identify...） */
type ClarityCall = [action: string, ...args: unknown[]];

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    clarity?: ClarityFn;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const pendingClarityCalls: ClarityCall[] = [];

function callClarity(...args: ClarityCall) {
  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.clarity === 'function') {
    window.clarity(...args);
    return;
  }

  pendingClarityCalls.push(args);
}

/** Clarity 脚本就绪后由 DeferredClarity 调用，把 hydration 阶段暂存的事件按序补发 */
export function flushAnalyticsQueue() {
  if (typeof window === 'undefined' || typeof window.clarity !== 'function') {
    return;
  }

  while (pendingClarityCalls.length > 0) {
    const args = pendingClarityCalls.shift();
    if (args) {
      window.clarity(...args);
    }
  }
}

function sendGaEvent(name: string, props?: EventProps) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag ??= function gtag() {
    // 官方 stub 的等价实现：把参数原样压入 dataLayer，gtag.js 加载后重放
    window.dataLayer?.push(arguments);
  };
  window.gtag('event', name, props);
}

/**
 * 记录一个漏斗事件：Clarity 记事件名（回放与漏斗可用），GA4 带参数（可做报表）。
 * Clarity 的事件本身不支持参数，需要维度时用 {@link setCustomTag} 单独打标。
 */
export function trackEvent(name: string, props?: EventProps) {
  callClarity('event', name);
  sendGaEvent(name, props);
}

/** 给当前 Clarity 会话打自定义标签（如 topup_amount），最多 30 个，字符串值 */
export function setCustomTag(key: string, value: string) {
  callClarity('set', key, value);
}
