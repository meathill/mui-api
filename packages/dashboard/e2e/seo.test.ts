import { expect, test } from '@playwright/test';
import { defaultMessages } from './test-messages';

test.describe('SEO', () => {
  test.describe('首页 meta 标签', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
    });

    test('包含正确的 title', async ({ page }) => {
      await expect(page).toHaveTitle(/MuiRouter/);
      await expect(page).toHaveTitle(new RegExp(defaultMessages.metadata.ogTitle));
    });

    test('包含 description', async ({ page }) => {
      const description = page.locator('meta[name="description"]');
      await expect(description).toHaveAttribute('content', defaultMessages.metadata.description);
    });

    test('包含 keywords', async ({ page }) => {
      const keywords = page.locator('meta[name="keywords"]');
      await expect(keywords).toHaveAttribute('content', /AI API/);
      await expect(keywords).toHaveAttribute('content', /OpenAI/);
    });

    test('包含 Open Graph 标签', async ({ page }) => {
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /muirouter\.com/);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /.+/);
    });

    test('包含 Twitter Card 标签', async ({ page }) => {
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', /.+/);
    });

    test('包含 canonical 链接', async ({ page }) => {
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /muirouter\.com/);
    });

    test('包含 JSON-LD 结构化数据', async ({ page }) => {
      const jsonLd = page.locator('script[type="application/ld+json"]');
      await expect(jsonLd).toBeAttached();
      const content = await jsonLd.textContent();
      const data = JSON.parse(content!);
      expect(data['@context']).toBe('https://schema.org');
      expect(data['@graph']).toBeInstanceOf(Array);
      expect(data['@graph'].some((item: { '@type': string }) => item['@type'] === 'Organization')).toBe(true);
      expect(data['@graph'].some((item: { '@type': string }) => item['@type'] === 'WebApplication')).toBe(true);
    });
  });

  test.describe('语义化 HTML', () => {
    test('首页有且仅有一个 h1', async ({ page }) => {
      await page.goto('/');
      const h1s = page.locator('h1');
      await expect(h1s).toHaveCount(1);
    });

    test('首页有多个 h2 标题', async ({ page }) => {
      await page.goto('/');
      const h2Count = await page.locator('h2').count();
      expect(h2Count).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('SEO 文件', () => {
    test('robots.txt 可访问', async ({ page }) => {
      const response = await page.goto('/robots.txt');
      expect(response?.status()).toBe(200);
      const text = await page.textContent('body');
      expect(text).toContain('User-Agent');
      expect(text).toContain('sitemap.xml');
    });

    test('sitemap.xml 可访问', async ({ page }) => {
      const response = await page.goto('/sitemap.xml');
      expect(response?.status()).toBe(200);
      const text = await response?.text();
      expect(text).toContain('/pricing');
      expect(text).toContain('<loc>https://muirouter.com/blog</loc>');
      expect(text).toContain('<loc>https://muirouter.com/blog/gpt-5-5</loc>');
      expect(text).toContain('<loc>https://muirouter.com/zh/blog/gpt-5-5</loc>');
      expect(text).toContain('hreflang="x-default" href="https://muirouter.com/blog/gpt-5-5"');
    });
  });

  test.describe('子页面 meta', () => {
    test('登录页有独立 title', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveTitle(new RegExp(defaultMessages.header.login));
      await expect(page).toHaveTitle(/MuiRouter/);
    });

    test('注册页有独立 title', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveTitle(new RegExp(defaultMessages.header.register));
      await expect(page).toHaveTitle(/MuiRouter/);
    });

    test('价格页有独立 title 和 description', async ({ page }) => {
      await page.goto('/pricing');
      await expect(page).toHaveTitle(new RegExp(defaultMessages.pricing.metadata.title));
      await expect(page).toHaveTitle(/MuiRouter/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        defaultMessages.pricing.metadata.description,
      );
    });

    test('博客文章有文章类型 meta 和可访问的 Open Graph 图片', async ({ page, request }) => {
      await page.goto('/blog/gpt-5-5');
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /GPT-5\.5/);

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
      expect(ogImage).toBeTruthy();

      const ogImageUrl = new URL(ogImage!, page.url());
      const response = await request.get(`${ogImageUrl.pathname}${ogImageUrl.search}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  });
});
