import { test, expect } from '@playwright/test';

test.describe('营销页面', () => {
  test('首页可访问且包含标题', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('一个 Key');
  });

  test('首页包含注册和登录链接', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: '免费注册' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: '登录' })).toBeVisible();
  });

  test('点击注册链接跳转到注册页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '免费注册' }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('点击登录链接跳转到登录页', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '登录' }).click();
    await expect(page).toHaveURL('/login');
  });
});
