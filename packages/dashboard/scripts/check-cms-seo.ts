/**
 * 检查 muicv CMS（articles 集合，site=muirouter）的 SEO 文案是否符合 issue #15 的约束。
 *
 * 约束（详见 DEV_NOTE.md「无译文页面的 canonical 与 meta 文案约束」）：
 *   1. 「seoTitle + ' | MuiRouter'」显示宽度 ≤65，CJK 按 2 计（页面 title.template 会追加品牌）；
 *   2. seoTitle 自身不带品牌后缀，否则会渲染成「… - MuiRouter | MuiRouter」；
 *   3. seoDescription ≥120 字符（Bing 把 <120 判为过短，CJK 也按字符数算），并 ≤320 兜底
 *      （与 src/lib/meta-copy.test.ts 同一口径；120–160 是书写目标，超过 160 只在报告里提示，
 *       搜索结果本来就会截断，不做硬失败）。
 *
 * 博客页会优先读 seoTitle / seoDescription（缺失才回退 title / summary），所以这两个字段是
 * 搜索引擎实际看到的内容；发新文章或批量改文案后跑一次本脚本即可。
 *
 * 用法：pnpm --dir packages/dashboard run check:cms-seo
 * 纯 node 执行，不依赖 @/* 别名（同 scripts/indexnow.ts 的取舍）。
 */

const CMS_ARTICLES_URL =
  'https://cms.muicv.com/api/articles?depth=0&limit=200&where%5Bsite%5D%5Bequals%5D=muirouter&where%5Bstatus%5D%5Bequals%5D=published';

const BRAND_SUFFIX = ' | MuiRouter';
const MAX_TITLE_WIDTH = 65;
const MIN_DESCRIPTION_LENGTH = 120;
/** 硬失败上限；120–160 只是书写目标。 */
const MAX_DESCRIPTION_LENGTH = 320;
/** 超过这个长度只提示不失败。 */
const RECOMMENDED_DESCRIPTION_LENGTH = 160;

// 汉字、假名、谚文与全角标点按 2 个显示宽度计（与 Bing 的口径一致）。
const WIDE_CHAR_PATTERN =
  /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

export function displayWidth(text: string): number {
  let total = 0;
  for (const char of text) {
    total += WIDE_CHAR_PATTERN.test(char) ? 2 : 1;
  }
  return total;
}

export type CmsSeoArticle = {
  slug: string;
  locale: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type CmsSeoViolation = {
  slug: string;
  locale: string;
  field: 'seoTitle' | 'seoDescription';
  problem: string;
  value: string;
};

export function checkCmsSeoArticles(articles: readonly CmsSeoArticle[]): CmsSeoViolation[] {
  const violations: CmsSeoViolation[] = [];

  for (const article of articles) {
    const seoTitle = article.seoTitle?.trim() ?? '';
    if (!seoTitle) {
      violations.push({
        slug: article.slug,
        locale: article.locale,
        field: 'seoTitle',
        problem: '缺 seoTitle（会回退到 title，宽度往往超标）',
        value: '',
      });
    } else {
      const width = displayWidth(seoTitle) + displayWidth(BRAND_SUFFIX);
      if (width > MAX_TITLE_WIDTH) {
        violations.push({
          slug: article.slug,
          locale: article.locale,
          field: 'seoTitle',
          problem: `含品牌后缀显示宽度 ${width} > ${MAX_TITLE_WIDTH}`,
          value: seoTitle,
        });
      }
      if (/[-|—]\s*MuiRouter\s*$/i.test(seoTitle)) {
        violations.push({
          slug: article.slug,
          locale: article.locale,
          field: 'seoTitle',
          problem: '自带品牌后缀，会与页面模板重复',
          value: seoTitle,
        });
      }
    }

    const seoDescription = article.seoDescription?.trim() ?? '';
    if (!seoDescription) {
      violations.push({
        slug: article.slug,
        locale: article.locale,
        field: 'seoDescription',
        problem: '缺 seoDescription（会回退到 summary）',
        value: '',
      });
    } else if (seoDescription.length < MIN_DESCRIPTION_LENGTH) {
      violations.push({
        slug: article.slug,
        locale: article.locale,
        field: 'seoDescription',
        problem: `描述 ${seoDescription.length} 字符 < ${MIN_DESCRIPTION_LENGTH}`,
        value: seoDescription,
      });
    } else if (seoDescription.length > MAX_DESCRIPTION_LENGTH) {
      violations.push({
        slug: article.slug,
        locale: article.locale,
        field: 'seoDescription',
        problem: `描述 ${seoDescription.length} 字符 > ${MAX_DESCRIPTION_LENGTH}`,
        value: seoDescription,
      });
    }
  }

  return violations;
}

/** 超过 160（书写目标）但未触犯硬上限的描述，只提示。 */
export function listLongDescriptions(articles: readonly CmsSeoArticle[]): CmsSeoViolation[] {
  return articles
    .filter((article) => (article.seoDescription?.length ?? 0) > RECOMMENDED_DESCRIPTION_LENGTH)
    .map((article) => ({
      slug: article.slug,
      locale: article.locale,
      field: 'seoDescription' as const,
      problem: `描述 ${article.seoDescription?.length ?? 0} 字符 > ${RECOMMENDED_DESCRIPTION_LENGTH}（书写目标，不失败）`,
      value: article.seoDescription ?? '',
    }));
}

async function main(): Promise<void> {
  const response = await fetch(CMS_ARTICLES_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    console.error(`拉取 CMS 失败：HTTP ${response.status}`);
    process.exit(1);
  }
  const payload = (await response.json()) as { docs?: CmsSeoArticle[] };
  const articles = payload.docs ?? [];

  const violations = checkCmsSeoArticles(articles);
  const longDescriptions = listLongDescriptions(articles);
  console.log(`检查 ${articles.length} 篇已发布文档，发现 ${violations.length} 处不符合约束。`);
  for (const violation of violations) {
    console.log(`  [${violation.locale}] ${violation.slug} ${violation.field}: ${violation.problem}`);
    if (violation.value) {
      console.log(`      ${violation.value}`);
    }
  }
  if (longDescriptions.length > 0) {
    console.log(`另有 ${longDescriptions.length} 条描述超过 160 字符（书写目标，不失败）：`);
    for (const item of longDescriptions) {
      console.log(`  [${item.locale}] ${item.slug}: ${item.problem}`);
    }
  }
  process.exit(violations.length > 0 ? 1 : 0);
}

// 仅在直接执行时跑 main（被测试 import 时不触发网络请求）。
if (process.argv[1]?.endsWith('check-cms-seo.ts')) {
  await main();
}
