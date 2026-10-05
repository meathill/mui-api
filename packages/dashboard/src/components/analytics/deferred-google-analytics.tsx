'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

/**
 * 把 @next/third-parties 的 GoogleAnalytics 推迟到 window.load 之后再挂载。
 * 营销页 LCP 元素是 hero 文案（文本），瓶颈是 Render Delay；GTM 脚本被标成 High
 * 优先级并在 <head> 里 preload，会和首屏 CSS / 字体争抢，阻塞 LCP。
 * load 后再注入对普通用户分析几乎无影响，却能显著缩短 /mcp-router 等页的 LCP。
 */
export function DeferredGoogleAnalytics({ gaId }: { gaId: string }) {
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
  return <GoogleAnalytics gaId={gaId} />;
}
