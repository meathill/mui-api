import { expect, test } from '@playwright/test';
import { defaultMessages } from './test-messages';

test.describe('营销页面', () => {
  const registerLink = { name: defaultMessages.header.register, exact: true } as const;
  const signInLink = { name: defaultMessages.header.signIn, exact: true } as const;
  const blogLink = { name: defaultMessages.header.blog, exact: true } as const;
  const pricingLink = { name: defaultMessages.header.pricing, exact: true } as const;

  test('首页可访问且包含标题', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('h1');
    await expect(title).toContainText(defaultMessages.hero.title);
    await expect(title).toContainText(defaultMessages.hero.titleHighlight);
  });

  test('首页模型区展示新增 Provider 和模型', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Workers AI', { exact: true })).toBeVisible();
    await expect(page.getByText('Xiaomi MiMo', { exact: true })).toBeVisible();
    await expect(page.getByText('GLM-4.7 Flash', { exact: true })).toBeVisible();
    await expect(page.getByText('MiMo TTS', { exact: true })).toBeVisible();
  });

  test('首页 Header 按指定顺序展示入口', async ({ page }) => {
    await page.goto('/');
    const logo = page.getByRole('link', { name: 'MUI Router', exact: true });
    const navigation = page.getByRole('navigation');
    const pricing = navigation.getByRole('link', pricingLink);
    const blog = navigation.getByRole('link', blogLink);
    const language = navigation.getByRole('combobox');
    const signIn = navigation.getByRole('link', signInLink);

    await expect(logo).toBeVisible();
    await expect(pricing).toBeVisible();
    await expect(blog).toBeVisible();
    await expect(language).toBeVisible();
    await expect(signIn).toBeVisible();
    await expect(navigation.getByRole('link', registerLink)).toHaveCount(0);

    const [logoBox, pricingBox, blogBox, languageBox, signInBox] = await Promise.all([
      logo.boundingBox(),
      pricing.boundingBox(),
      blog.boundingBox(),
      language.boundingBox(),
      signIn.boundingBox(),
    ]);

    if (!logoBox || !pricingBox || !blogBox || !languageBox || !signInBox) {
      throw new Error('Header items must be visible before checking order.');
    }

    expect(logoBox.x).toBeLessThan(pricingBox.x);
    expect(pricingBox.x).toBeLessThan(blogBox.x);
    expect(blogBox.x).toBeLessThan(languageBox.x);
    expect(languageBox.x).toBeLessThan(signInBox.x);
  });

  test('点击首页主 CTA 跳转到注册页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: defaultMessages.hero.ctaPrimary, exact: true }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('点击登录链接跳转到登录页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', signInLink).click();
    await expect(page).toHaveURL('/login');
  });

  test('首页导航包含价格页入口并可跳转', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', pricingLink).click();
    await expect(page).toHaveURL('/pricing');
    await expect(page.getByRole('heading', { level: 1, name: defaultMessages.pricing.title })).toBeVisible();
  });

  test('首页导航包含博客入口并可跳转', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', blogLink).click();
    await expect(page).toHaveURL('/blog');
    await expect(page.getByRole('heading', { level: 1, name: defaultMessages.blog.title })).toBeVisible();
  });

  test('点击查看定价按钮跳转到价格页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: defaultMessages.hero.ctaSecondary, exact: true }).click();
    await expect(page).toHaveURL('/pricing');
  });

  test('价格页展示 OpenAI 和 Gemini 的主要价格', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1, name: defaultMessages.pricing.title })).toBeVisible();
    await expect(page.getByText('OpenAI').first()).toBeVisible();
    await expect(page.getByText('Gemini').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'GPT-5.4', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'gemini-3.1-pro-preview', exact: true }).first()).toBeVisible();
  });

  test('博客列表展示 GPT-5.5 文章并可进入详情', async ({ page }) => {
    await page.goto('/blog');
    await expect(page.getByRole('heading', { level: 2, name: /GPT-5\.5 Is Here/ })).toBeVisible();

    await page.getByRole('link', { name: defaultMessages.blog.readArticle, exact: true }).click();
    await expect(page).toHaveURL('/blog/gpt-5-5');
    await expect(page.getByRole('heading', { level: 1, name: /GPT-5\.5 Is Here/ })).toBeVisible();
  });

  test('GPT-5.5 文章展示官方来源和 API coming soon 说明', async ({ page }) => {
    await page.goto('/blog/gpt-5-5');

    await expect(page.getByRole('heading', { level: 1, name: /GPT-5\.5 Is Here/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: defaultMessages.blog.sourcesTitle })).toBeVisible();
    await expect(page.getByRole('link', { name: 'OpenAI GPT-5.5 announcement' })).toBeVisible();
    await expect(page.getByText('coming to the API very soon')).toBeVisible();
  });

  test('GPT-5.5 文章注册 CTA 跳转注册页', async ({ page }) => {
    await page.goto('/blog/gpt-5-5');
    await page.getByRole('link', { name: defaultMessages.blog.ctaButton, exact: true }).last().click();
    await expect(page).toHaveURL('/register');
  });

  test('非英文路径展示本地化博客正文', async ({ page }) => {
    await page.goto('/zh/blog');
    await expect(page.getByRole('heading', { level: 2, name: /GPT-5\.5 已发布/ })).toBeVisible();

    await page.goto('/zh/blog/gpt-5-5');
    await expect(page.getByRole('heading', { level: 1, name: /GPT-5\.5 已发布/ })).toBeVisible();
    await expect(page.getByText('2026 年 4 月 23 日，OpenAI 发布了 GPT-5.5')).toBeVisible();
    await expect(page.getByRole('link', { name: 'OpenAI GPT-5.5 发布公告' })).toBeVisible();
  });
});
