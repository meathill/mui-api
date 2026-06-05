/**
 * 把参数对象拼成 query string，跳过 undefined / null / 空字符串。
 * 抽取自 api.ts 中重复多次的 URLSearchParams 构造逻辑。
 */
export function buildQuery<T extends object>(params: T): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  }
  return query.toString();
}
