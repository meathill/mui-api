'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { flushAnalyticsQueue } from '@/lib/analytics';

/**
 * 把 Microsoft Clarity 推迟到 window.load 之后再挂载，与 DeferredGoogleAnalytics
 * 保持同一策略：营销页 LCP 是瓶颈，分析脚本不该和首屏 CSS / 字体争抢优先级。
 *
 * 脚本就绪后立即 flush analytics.ts 的待发队列：hydration 阶段触发的事件
 * （如从 Stripe 返回的 topup_cancelled）会先暂存，不能因为延迟加载而丢失。
 */
export function DeferredClarity({ clarityId }: { clarityId: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    function enable() {
      setReady(true);
    }

    if (document.readyState === 'complete') {
      // 已经 load 过：再让出一帧，避免和 hydration 抢主线程
      const id = window.setTimeout(enable, 0);
      return () => window.clearTimeout(id);
    }

    window.addEventListener('load', enable, { once: true });
    return () => window.removeEventListener('load', enable);
  }, [ready]);

  if (!ready) return null;
  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      onReady={() => {
        // snippet 同步执行完毕后 window.clarity 已可用，此时补发暂存事件
        flushAnalyticsQueue();
      }}
    >
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
    </Script>
  );
}
