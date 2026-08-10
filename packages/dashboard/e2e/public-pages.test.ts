import { expect, test } from '@playwright/test';
import { defaultMessages, messagesByLocale } from './test-messages';

/**
 * 公共内容页的渲染回归。
 *
 * 2026-08-09 的一次发布让 blog 列表、blog 详情、pricing 在所有语言下返回 500，
 * 当时没有任何测试覆盖「这些页面能不能真的渲染出内容」。补上这一层。
 *
 * 注意这里跑的是 `next dev`（Node 运行时），复现不了 workerd 上的 Cache Components
 * 挂死；那一层由构建后的 scripts/check-render-modes.ts 守住。这里守的是
 * 「响应状态正确 + 正文有真实内容，而不是骨架屏或 soft 404」。
 */
test.describe('公共内容页', () => {
  test('Blog 列表渲染出真实文章，而不是骨架屏', async ({ page }) => {
    const response = await page.goto('/blog');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1, name: defaultMessages.blog.title })).toBeVisible();
    // 文章卡片是 <article>，骨架屏没有；数量 > 0 才说明 D1 查询真的跑通了
    await expect(page.locator('article').first()).toBeVisible();
    expect(await page.locator('article').count()).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { level: 2, name: /Kimi K3/ })).toBeVisible();
  });

  test('Pricing 渲染出真实价格表，而不是骨架屏', async ({ page }) => {
    const response = await page.goto('/pricing');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1, name: defaultMessages.pricing.title })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'e2e-openai-chat', exact: true }).first()).toBeVisible();
  });

  test('Blog 详情渲染出正文与 JSON-LD', async ({ page }) => {
    const response = await page.goto('/blog/kimi-k3');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const entities = jsonLd.map((content) => JSON.parse(content) as { '@type'?: string });
    expect(entities.some((entity) => entity['@type'] === 'BlogPosting')).toBe(true);
  });

  test('不存在的 slug 返回 404，而不是 200 的 soft 404', async ({ page }) => {
    const response = await page.goto('/blog/this-slug-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  // 500 事故是全语言的，抽查几个非默认 locale 确认前缀路由也正常
  for (const locale of ['zh', 'ja', 'de'] as const) {
    test(`${locale} 的 blog 与 pricing 都能渲染出内容`, async ({ page }) => {
      const messages = messagesByLocale[locale];

      const blogResponse = await page.goto(`/${locale}/blog`);
      expect(blogResponse?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: messages.blog.title })).toBeVisible();
      expect(await page.locator('article').count()).toBeGreaterThan(0);

      const pricingResponse = await page.goto(`/${locale}/pricing`);
      expect(pricingResponse?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: messages.pricing.title })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'e2e-openai-chat', exact: true }).first()).toBeVisible();
    });
  }
});
