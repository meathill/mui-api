import { describe, expect, it } from 'vitest';
import deMessages from '../../messages/de.json';
import enMessages from '../../messages/en.json';
import esMessages from '../../messages/es.json';
import frMessages from '../../messages/fr.json';
import jaMessages from '../../messages/ja.json';
import ptMessages from '../../messages/pt.json';
import thMessages from '../../messages/th.json';
import zhMessages from '../../messages/zh.json';
import { type Locale, locales } from '@/i18n/config';
import { getBilingualPageMeta } from './page-meta';

/** issue #15：Bing 把 <120 字符的描述判为过短（CJK 也按字符数算）；这里只守下限，
 *  上线目标是 120–160，超过 160 会被结果页截断但不扣分。 */
const MIN_DESCRIPTION_LENGTH = 120;
/** 兜底上限：防止某次改写误把合并段落塞进描述。 */
const MAX_DESCRIPTION_LENGTH = 320;
/** Bing：标题显示宽度 >65 即过长，中文按 2 计。口径含 layout 模板追加的「 | MuiRouter」。 */
const MAX_TITLE_DISPLAY_WIDTH = 65;
const BRAND_SUFFIX = ' | MuiRouter';

const MESSAGES_BY_LOCALE: Record<Locale, unknown> = {
  en: enMessages,
  zh: zhMessages,
  fr: frMessages,
  es: esMessages,
  pt: ptMessages,
  de: deMessages,
  th: thMessages,
  ja: jaMessages,
};

// CJK 汉字、假名、谚文与全角标点按 2 个显示宽度计。
const WIDE_CHAR_PATTERN =
  /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function displayWidth(text: string): number {
  let total = 0;
  for (const char of text) {
    total += WIDE_CHAR_PATTERN.test(char) ? 2 : 1;
  }
  return total;
}

type MetaSurface = {
  /** 展示用的命名空间路径，例如 marketing-metadata 或 claudeApiGateway。 */
  key: string;
  title: string;
  description?: string;
};

/**
 * 按命名约定收集页面 meta 文案：顶层 `metadata`，以及各命名空间里的
 * `metaTitle`/`metaDescription` 或嵌套 `metadata.{title,description}`。
 * 新页面只要照约定命名，就自动进入长度/宽度约束，不需要在测试里登记。
 */
function collectMetaSurfaces(messages: unknown, locale: Locale): MetaSurface[] {
  if (messages === null || typeof messages !== 'object') {
    return [];
  }
  const root = messages as Record<string, unknown>;
  const surfaces: MetaSurface[] = [];
  const topLevel = root.metadata as { title?: unknown; description?: unknown } | undefined;
  if (typeof topLevel?.title === 'string' && typeof topLevel.description === 'string') {
    surfaces.push({ key: 'metadata', title: topLevel.title, description: topLevel.description });
  }

  for (const [namespace, value] of Object.entries(root)) {
    if (namespace === 'metadata' || value === null || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    const node = value as Record<string, unknown>;
    if (typeof node.metaTitle === 'string') {
      surfaces.push({
        key: namespace,
        title: node.metaTitle,
        description: typeof node.metaDescription === 'string' ? node.metaDescription : undefined,
      });
      continue;
    }
    const nested = node.metadata as { title?: unknown; description?: unknown } | undefined;
    if (typeof nested?.title === 'string') {
      surfaces.push({
        key: `${namespace}.metadata`,
        title: nested.title,
        description: typeof nested.description === 'string' ? nested.description : undefined,
      });
    }
  }

  expect(surfaces.length, `${locale} 未找到任何 meta 文案，命名约定可能被破坏`).toBeGreaterThan(0);
  return surfaces;
}

describe('marketing meta 文案约束（issue #15）', () => {
  for (const locale of locales) {
    describe(locale, () => {
      const surfaces = collectMetaSurfaces(MESSAGES_BY_LOCALE[locale], locale);

      it('所有描述 ≥120 字符（Bing 判为过短的阈值）', () => {
        const tooShort = surfaces
          .filter((surface) => surface.description !== undefined && surface.description.length < MIN_DESCRIPTION_LENGTH)
          .map((surface) => `${surface.key}: ${surface.description?.length} 字符`);
        expect(tooShort).toEqual([]);
      });

      it('所有描述 ≤320 字符', () => {
        const tooLong = surfaces
          .filter((surface) => surface.description !== undefined && surface.description.length > MAX_DESCRIPTION_LENGTH)
          .map((surface) => `${surface.key}: ${surface.description?.length} 字符`);
        expect(tooLong).toEqual([]);
      });

      it('标题含品牌后缀后显示宽度 ≤65', () => {
        const tooWide = surfaces
          .filter((surface) => displayWidth(surface.title) + displayWidth(BRAND_SUFFIX) > MAX_TITLE_DISPLAY_WIDTH)
          .map(
            (surface) =>
              `${surface.key}: ${displayWidth(surface.title) + displayWidth(BRAND_SUFFIX)}（${surface.title}）`,
          );
        expect(tooWide).toEqual([]);
      });

      it('标题不重复品牌（layout 模板已追加 | MuiRouter）', () => {
        const duplicated = surfaces
          .filter((surface) => /[-|]\s*MuiRouter\s*$/.test(surface.title))
          .map((surface) => `${surface.key}: ${surface.title}`);
        expect(duplicated).toEqual([]);
      });
    });
  }

  // 文案只有中英两套的页面（about/contact/privacy/terms/models）走 page-meta.ts，
  // 同样受长度与宽度约束，其余语言复用英文文案。
  describe('page-meta.ts（中英双语页面）', () => {
    const BILINGUAL_PAGES = ['about', 'contact', 'privacy', 'terms', 'models'] as const;

    it('描述 ≥120 且 ≤320 字符', () => {
      const violations: string[] = [];
      for (const page of BILINGUAL_PAGES) {
        for (const locale of ['en', 'zh'] as const) {
          const { description } = getBilingualPageMeta(page, locale);
          if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
            violations.push(`${page}/${locale}: ${description.length} 字符`);
          }
        }
      }
      expect(violations).toEqual([]);
    });

    it('标题含品牌后缀后显示宽度 ≤65，且不含品牌后缀', () => {
      const violations: string[] = [];
      for (const page of BILINGUAL_PAGES) {
        for (const locale of ['en', 'zh'] as const) {
          const { title } = getBilingualPageMeta(page, locale);
          if (displayWidth(title) + displayWidth(BRAND_SUFFIX) > MAX_TITLE_DISPLAY_WIDTH) {
            violations.push(`${page}/${locale}: 宽度 ${displayWidth(title) + displayWidth(BRAND_SUFFIX)}`);
          }
          if (/[-|]\s*MuiRouter\s*$/.test(title)) {
            violations.push(`${page}/${locale}: 标题重复品牌（${title}）`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });
});
