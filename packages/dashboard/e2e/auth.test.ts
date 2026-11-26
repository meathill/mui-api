import { expect, test } from '@playwright/test';
import { defaultMessages } from './test-messages';

test.describe('登录页面', () => {
  test('登录页可访问且包含 OTP 表单', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(defaultMessages.login.title);
    await expect(page.getByPlaceholder(defaultMessages.authOtp.emailPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: defaultMessages.authOtp.sendCode })).toBeVisible();
    await expect(page.getByRole('link', { name: defaultMessages.authOtp.termsLink })).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: defaultMessages.authOtp.privacyLink })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  test('登录页有注册链接', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('main').getByRole('link', { name: defaultMessages.login.register, exact: true }),
    ).toBeVisible();
  });

  test('新邮箱可通过 OTP 自动注册并登录', async ({ page }) => {
    const email = `otp-login-${Date.now()}@example.com`;
    await page.goto('/login');
    await page.getByPlaceholder(defaultMessages.authOtp.emailPlaceholder).fill(email);
    await page.getByRole('button', { name: defaultMessages.authOtp.sendCode }).click();

    const slots = page.locator('[data-slot="otp-field-input"]');
    await expect(slots).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      await slots.nth(index).fill(String(index + 1));
    }

    await expect(page).toHaveURL(/\/app$/);
  });

  test('+ 别名登录已有主账号且不会创建重复账号', async ({ page }) => {
    const email = `otp-alias-${Date.now()}@example.com`;
    const alias = email.replace('@', '+tag@');

    const sendBase = await page.request.post('/api/auth/email-otp/send-verification-otp', {
      data: { email, type: 'sign-in' },
    });
    expect(sendBase.ok()).toBe(true);
    const signInBase = await page.request.post('/api/auth/sign-in/email-otp', {
      data: { email, otp: '123456', name: 'Alias Test' },
    });
    expect(signInBase.ok()).toBe(true);
    const baseUser = (await signInBase.json()) as { user: { id: string; email: string } };

    const sendAlias = await page.request.post('/api/auth/email-otp/send-verification-otp', {
      headers: { Origin: 'http://localhost:3035' },
      data: { email: alias, type: 'sign-in' },
    });
    expect(sendAlias.ok(), await sendAlias.text()).toBe(true);
    const signInAlias = await page.request.post('/api/auth/sign-in/email-otp', {
      headers: { Origin: 'http://localhost:3035' },
      data: { email: alias, otp: '123456' },
    });
    expect(signInAlias.ok()).toBe(true);
    const aliasUser = (await signInAlias.json()) as { user: { id: string; email: string } };

    expect(aliasUser.user.id).toBe(baseUser.user.id);
    expect(aliasUser.user.email).toBe(email);
  });

  test('历史别名账号首次登录时迁移为主邮箱', async ({ page }) => {
    const sendAlias = await page.request.post('/api/auth/email-otp/send-verification-otp', {
      data: { email: 'legacy+tag@example.com', type: 'sign-in' },
    });
    expect(sendAlias.ok()).toBe(true);
    const signInAlias = await page.request.post('/api/auth/sign-in/email-otp', {
      data: { email: 'legacy+tag@example.com', otp: '123456' },
    });
    expect(signInAlias.ok()).toBe(true);
    const aliasUser = (await signInAlias.json()) as { user: { id: string; email: string } };

    expect(aliasUser.user.id).toBe('e2e-legacy-alias-user');
    expect(aliasUser.user.email).toBe('legacy@example.com');
  });

  test('不存在的 + 别名不会自动注册', async ({ page }) => {
    const email = `otp-missing-alias-${Date.now()}@example.com`;
    const alias = email.replace('@', '+tag@');

    const sendAlias = await page.request.post('/api/auth/email-otp/send-verification-otp', {
      headers: { Origin: 'http://localhost:3035' },
      data: { email: alias, type: 'sign-in' },
    });
    expect(sendAlias.ok(), await sendAlias.text()).toBe(true);
    const signInAlias = await page.request.post('/api/auth/sign-in/email-otp', {
      headers: { Origin: 'http://localhost:3035' },
      data: { email: alias, otp: '123456' },
    });
    expect(signInAlias.ok()).toBe(false);

    const passwordSignIn = await page.request.post('/api/auth/sign-in/email', {
      data: { email, password: 'not-supported' },
    });
    expect(passwordSignIn.status()).toBe(400);
  });
});

test.describe('注册页面', () => {
  test('注册页可访问且包含 OTP 表单', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('h1')).toContainText(defaultMessages.register.title);
    await expect(page.getByPlaceholder(defaultMessages.register.namePlaceholder)).toBeVisible();
    await expect(page.getByPlaceholder(defaultMessages.authOtp.emailPlaceholder)).toBeVisible();
    await expect(page.getByRole('button', { name: defaultMessages.authOtp.sendCode })).toBeVisible();
    await expect(page.getByPlaceholder(defaultMessages.register.passwordPlaceholder)).toHaveCount(0);
  });

  test('注册页有登录链接', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('link', { name: defaultMessages.register.login })).toBeVisible();
  });
});
