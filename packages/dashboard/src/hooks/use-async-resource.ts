'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

/**
 * 封装"挂载/依赖变化时拉取数据"的 loading/error 样板。fetcher 由调用方自己用
 * useCallback 包一层带上真正的依赖，引用变化时本 hook 会自动重新拉取——
 * 与调用方原有的 `useEffect(() => { load() }, [load])` 触发时机一致。
 */
export function useAsyncResource<T>(fetcher: () => Promise<T>, initialData: T) {
  const te = useTranslations('errors');
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetcher());
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [fetcher, te]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, setError, setData, reload };
}
