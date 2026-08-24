import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import { buildMetadata, getLanguageAlternates } from '@/lib/seo';
import { buildSitemapEntries } from './sitemap';

const ROUTER_PAGES = ['/ai-router', '/llm-router', '/openai-compatible-router', '/mcp-router'] as const;
const MCP_THEME_PAGE = '/mcp-server' as const;
const PROVIDER_GATEWAY_PAGES = [
  '/claude-api-gateway',
  '/gpt-api-gateway',
  '/gemini-api-gateway',
  '/grok-api-gateway',
] as const;
const COMPARISON_LISTICLE_PAGES = [
  '/compare/openrouter',
  '/muirouter-vs-openrouter',
  '/litellm-vs-openrouter',
  '/openrouter-alternatives',
  '/best-llm-gateway',
] as const;

describe('sitemap', () => {
  const entries = buildSitemapEntries([
    {
      slug: 'codex-context-drift',
      href: '/blog/codex-context-drift',
      publishedAt: '2026-07-02',
    },
  ]);
  const urls = entries.map((entry) => entry.url);

  it('收录 4 个新 router 落地页（默认语言无前缀）', () => {
    for (const path of ROUTER_PAGES) {
      expect(urls).toContain(`https://muirouter.com${path}`);
    }
  });

  it('每个新路由覆盖全部 8 语言', () => {
    for (const path of ROUTER_PAGES) {
      for (const locale of locales) {
        const expected = locale === 'en' ? `https://muirouter.com${path}` : `https://muirouter.com/${locale}${path}`;
        expect(urls).toContain(expected);
      }
    }
  });

  it('收录 4 个 provider 落地页（issue #7），覆盖全部 8 语言', () => {
    for (const path of PROVIDER_GATEWAY_PAGES) {
      for (const locale of locales) {
        const expected = locale === 'en' ? `https://muirouter.com${path}` : `https://muirouter.com/${locale}${path}`;
        expect(urls).toContain(expected);
      }
    }
  });

  it('收录对比/榜单页（issue #7），覆盖全部 8 语言', () => {
    for (const path of COMPARISON_LISTICLE_PAGES) {
      for (const locale of locales) {
        const expected = locale === 'en' ? `https://muirouter.com${path}` : `https://muirouter.com/${locale}${path}`;
        expect(urls).toContain(expected);
      }
    }
  });

  it('收录 MCP server 主题页（issue #9），覆盖全部 8 语言', () => {
    for (const locale of locales) {
      const expected =
        locale === 'en' ? `https://muirouter.com${MCP_THEME_PAGE}` : `https://muirouter.com/${locale}${MCP_THEME_PAGE}`;
      expect(urls).toContain(expected);
    }
  });

  it('保留既有页面并排除 noindex 的 /login', () => {
    expect(urls).toContain('https://muirouter.com/');
    expect(urls).toContain('https://muirouter.com/pricing');
    expect(urls).toContain('https://muirouter.com/mcp');
    expect(urls).toContain('https://muirouter.com/blog/codex-context-drift');
    expect(urls).not.toContain('https://muirouter.com/login');
  });

  it('新路由条目带全语言 + x-default hreflang alternates', () => {
    const aiRouter = entries.find((entry) => entry.url === 'https://muirouter.com/ai-router');
    expect(aiRouter).toBeDefined();
    const langs = Object.keys(aiRouter?.alternates?.languages ?? {});
    for (const locale of locales) {
      expect(langs).toContain(locale);
    }
    expect(langs).toContain('x-default');
  });
});

describe('buildMetadata（新落地页）', () => {
  it('生成 self-canonical 与 8+1 条 hreflang', () => {
    const metaEs = buildMetadata({ path: '/ai-router', title: 'T', description: 'D', locale: 'es' });
    expect(metaEs.alternates?.canonical).toBe('/es/ai-router');

    const metaEn = buildMetadata({ path: '/ai-router', title: 'T', description: 'D', locale: 'en' });
    expect(metaEn.alternates?.canonical).toBe('/ai-router');

    const langs = Object.keys(metaEs.alternates?.languages ?? {});
    for (const locale of locales) {
      expect(langs).toContain(locale);
    }
    expect(langs).toContain('x-default');
  });

  it('x-default 指向无前缀英文路径', () => {
    const alts = getLanguageAlternates('/llm-router');
    expect(alts['x-default']).toBe('/llm-router');
    expect(alts.en).toBe('/llm-router');
    expect(alts.zh).toBe('/zh/llm-router');
  });
});
