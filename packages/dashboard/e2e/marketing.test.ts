import { test, expect } from '@playwright/test';
import { defaultMessages } from './test-messages';

test.describe('营销页面', () => {
  const registerLink = { name: defaultMessages.header.register, exact: true } as const;
  const loginLink = { name: defaultMessages.header.login, exact: true } as const;

  test('首页可访问且包含标题', async ({ page }) => {
    await page.goto('/');
    const title = page.locator('h1');
    await expect(title).toContainText(defaultMessages.hero.title);
    await expect(title).toContainText(defaultMessages.hero.titleHighlight);
  });

  test('首页包含注册和登录链接', async ({ page }) => {
    await page.goto('/');
    const navigation = page.getByRole('navigation');
    await expect(navigation.getByRole('link', registerLink)).toBeVisible();
    await expect(navigation.getByRole('link', loginLink)).toBeVisible();
  });

  test('点击注册链接跳转到注册页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', registerLink).click();
    await expect(page).toHaveURL('/register');
  });

  test('点击登录链接跳转到登录页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation').getByRole('link', loginLink).click();
    await expect(page).toHaveURL('/login');
  });
});
