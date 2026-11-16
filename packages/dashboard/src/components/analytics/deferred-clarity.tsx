'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

/**
 * 把 Microsoft Clarity 推迟到 window.load 之后再挂载，与 DeferredGoogleAnalytics
 * 保持同一策略：营销页 LCP 是瓶颈，分析脚本不该和首屏 CSS / 字体争抢优先级。
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
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
    </Script>
  );
}
