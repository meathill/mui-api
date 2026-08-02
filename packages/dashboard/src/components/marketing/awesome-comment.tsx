'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

/**
 * 博客详情页的 Awesome Comment 评论区。
 *
 * widget 不走 npm 包，运行时从 unpkg 拉远程 ESM（`webpackIgnore` 让打包器别去解析），
 * 因此 JS 和 CSS 都不进 bundle。
 *
 * ⚠️ 升级版本要同步改 4 处字符串：下面的 cssUrl、两个 import()，以及
 * `src/types/remote-modules.d.ts` 里的两个 declare module。TS 的模块声明按 URL 字面量
 * 精确匹配，所以这些 URL 不能用常量拼接。
 */

const SITE_ID = '2119d7b0-bc52-4fdc-94ac-770d63ecda63';
const API_URL = 'https://awesomecomment.org';
// 必须用全局 Google Client ID：awesomecomment.org 校验 ID token 的 audience 时读的是全局
// NEXT_PUBLIC_GOOGLE_CLIENT_ID，配站点级 Client ID 会 aud 不匹配直接 400。
const GOOGLE_CLIENT_ID = '553490336811-e0lmqt2vkb0nqfc4fbm83lc6mjo4ahbf.apps.googleusercontent.com';

// widget 的 `zh` 是繁体（討論/登錄/發表評論），而本站 zh.json 是简体，直接透传会变成
// 简体正文配繁体评论区。其余 7 个语种的代码 widget 都能正确识别，无需映射。
const WIDGET_LOCALE_OVERRIDES: Record<string, string> = {
  zh: 'zh-CN',
};

function loadStylesheet(): void {
  const cssUrl = 'https://unpkg.com/@roudanio/awesome-comment@0.10.10/dist/style.css';
  if (document.querySelector(`link[href="${cssUrl}"]`)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssUrl;
  document.head.appendChild(link);
}

export function AwesomeComment() {
  const t = useTranslations('blog');
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hasFailed, setHasFailed] = useState(false);

  // widget 的 daisyUI 只认祖先的 data-theme 或系统 prefers-color-scheme，而本站用的是
  // <html class="dark">。不同步的话，站内切到暗色而系统是亮色时评论区会是亮的。
  useEffect(() => {
    const root = document.documentElement;
    function sync() {
      setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    }
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (initializedRef.current || !container) {
      return;
    }

    async function loadAndInit(target: HTMLDivElement) {
      loadStylesheet();
      try {
        const [authModule, commentModule] = await Promise.all([
          import(/* webpackIgnore: true */ 'https://unpkg.com/@roudanio/awesome-auth@0.1.5/dist/awesome-auth.js'),
          import(
            /* webpackIgnore: true */ 'https://unpkg.com/@roudanio/awesome-comment@0.10.10/dist/awesome-comment.js'
          ),
        ]);

        const auth = authModule.getInstance({
          googleId: GOOGLE_CLIENT_ID,
          root: `${API_URL}/api/site/auth`,
          prefix: 'acSaas',
        });

        commentModule.default.init(target, {
          apiUrl: API_URL,
          awesomeAuth: auth,
          // 跟随页面语言而不是浏览器语言；本站 8 个语种 widget 都有对应文案
          locale: WIDGET_LOCALE_OVERRIDES[locale] ?? locale,
          // 按语种隔离：/blog/x 与 /zh/blog/x 是两条独立的评论线程
          postId: location.pathname,
          siteId: SITE_ID,
        });
      } catch (error) {
        console.error('Failed to load Awesome Comment:', error);
        setHasFailed(true);
      }
    }

    // 评论区在页面最底部，滚到了再加载，避免拖累首屏
    const observer = new IntersectionObserver((entries) => {
      // 幂等判断放在回调内部：光靠 disconnect() 挡不住同一批 entries 的重复触发，
      // 也挡不住 effect 因依赖变化重跑后又建了一个 observer
      if (initializedRef.current || !entries[0].isIntersecting) {
        return;
      }
      initializedRef.current = true;
      observer.disconnect();
      void loadAndInit(container);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [locale]);

  return (
    <section className="mt-10 max-w-3xl border-t border-border pt-8">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('commentsTitle')}</h2>
      {hasFailed ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{t('commentsError')}</p>
      ) : (
        <div id="awesome-comment" ref={containerRef} data-theme={theme} className="mt-6 min-h-50" />
      )}
    </section>
  );
}
