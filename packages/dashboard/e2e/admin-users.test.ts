import { expect, test } from '@playwright/test';
import { defaultMessages } from './test-messages';

const ADMIN_EMAIL = 'meathill@gmail.com';

test.use({ storageState: '.wrangler/e2e-state/admin-auth.json' });

test.describe('管理员查看用户详情', () => {
  test('从用户列表进入详情页，各区块正常渲染', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByPlaceholder(defaultMessages.adminUsers.searchPlaceholder).fill(ADMIN_EMAIL);

    const row = page.locator('tr', { hasText: ADMIN_EMAIL });
    await expect(row).toBeVisible();
    await row.getByRole('link', { name: defaultMessages.adminUsers.viewDetail }).click();

    await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
    await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();
    await expect(page.getByText(defaultMessages.adminUserDetail.sectionRecharge)).toBeVisible();
    await expect(page.getByText(defaultMessages.adminUserDetail.sectionUsage)).toBeVisible();
    await expect(page.getByText(defaultMessages.adminUserDetail.sectionDaily)).toBeVisible();
  });
});
