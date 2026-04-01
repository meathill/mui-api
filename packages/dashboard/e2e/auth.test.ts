import { test, expect } from '@playwright/test';
import { defaultMessages } from './test-messages';

test.describe('登录页面', () => {
  test('登录页可访问且包含表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toContainText(defaultMessages.login.title);
    await expect(page.getByPlaceholder(defaultMessages.login.emailPlaceholder)).toBeVisible();
    // 提交按钮（客户端组件，等待水合）
    await expect(page.getByRole('button', { name: defaultMessages.login.submit })).toBeVisible();
  });

  test('登录页有注册链接', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('main').getByRole('link', { name: defaultMessages.login.register, exact: true }),
    ).toBeVisible();
  });
});

test.describe('注册页面', () => {
  test('注册页可访问且包含表单', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h2')).toContainText(defaultMessages.register.title);
    await expect(page.getByPlaceholder(defaultMessages.register.emailPlaceholder)).toBeVisible();
    await expect(page.getByPlaceholder(defaultMessages.register.passwordPlaceholder)).toBeVisible();
    await expect(page.getByPlaceholder(defaultMessages.register.confirmPasswordPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: defaultMessages.register.submit })).toBeVisible();
  });

  test('注册页有登录链接', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('link', { name: defaultMessages.register.login })).toBeVisible();
  });
});
