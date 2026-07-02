// 钱包金额工具：统一处理 currency unit ↔ minor unit (cents) 的换算与展示格式。
// packages/app（余额快照 / Stripe 金额）与 packages/dashboard（余额展示）共用，
// 币种进位规则只在这里维护。当前所有支持币种（USD、CNY）都用 100 进位；
// 如未来加入 JPY 等零进位币种，在这里集中扩展即可。

const ZERO_DECIMAL_CURRENCIES = new Set<string>(['JPY', 'KRW', 'VND']);

function multiplier(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100;
}

export function toCents(amount: number, currency: string = 'USD'): number {
  return Math.round((amount || 0) * multiplier(currency));
}

export function fromCents(cents: number, currency: string = 'USD'): number {
  return cents / multiplier(currency);
}

export function formatBalance(amount: number, currency: string = 'USD'): string {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? String(Math.round(amount || 0))
    : (amount || 0).toFixed(2);
}
