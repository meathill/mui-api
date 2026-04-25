import { expect, test } from '@playwright/test';

test.describe('Dashboard 路由保护', () => {
  test('未登录访问 /app 重定向到 /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录访问 /keys 重定向到 /login', async ({ page }) => {
    await page.goto('/keys');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录访问 /usage 重定向到 /login', async ({ page }) => {
    await page.goto('/usage');
    await expect(page).toHaveURL(/\/login/);
  });
});
