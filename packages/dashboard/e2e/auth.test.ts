import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test('登录页可访问且包含表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText('登录');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    // 提交按钮（客户端组件，等待水合）
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('登录页有注册链接', async ({ page }) => {
    await page.goto('/login');
    // 页面底部的"注册"链接
    const card = page.locator('[class*="Card"], [class*="card"]').first();
    await expect(card.getByRole('link', { name: '注册' })).toBeVisible();
  });
});

test.describe('注册页面', () => {
  test('注册页可访问且包含表单', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h2')).toContainText('注册');
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('至少 8 个字符')).toBeVisible();
    await expect(page.getByPlaceholder('再次输入密码')).toBeVisible();
    await expect(page.getByRole('button', { name: /注册/ })).toBeVisible();
  });

  test('注册页有登录链接', async ({ page }) => {
    await page.goto('/register');
    // 页面底部 "已有账户？登录" 的链接
    await expect(page.locator('p').filter({ hasText: '已有账户' }).getByRole('link')).toBeVisible();
  });
});
