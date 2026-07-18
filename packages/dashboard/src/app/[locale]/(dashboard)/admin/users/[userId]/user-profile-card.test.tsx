// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserInfo } from '@/lib/api';
import { renderWithIntl } from '@/test/render-with-intl';
import { UserProfileCard } from './user-profile-card';

function createUser(overrides: Partial<UserInfo> = {}): UserInfo {
  return {
    userId: 'user-1',
    email: 'user-1@test.com',
    balance: 12.3456,
    concurrency: 2,
    isSuspended: false,
    maxConcurrency: 5,
    rateMultiplier: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UserProfileCard', () => {
  it('渲染邮箱、用户 ID、余额与并发字段', () => {
    renderWithIntl(<UserProfileCard user={createUser()} />);

    expect(screen.getByText('user-1@test.com')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('$12.3456')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('rateMultiplier 为 1 时显示纯文本 1x，不使用 Badge', () => {
    renderWithIntl(<UserProfileCard user={createUser({ rateMultiplier: 1 })} />);
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('rateMultiplier 不为 1 时用 Badge 显示具体倍率', () => {
    renderWithIntl(<UserProfileCard user={createUser({ rateMultiplier: 1.5 })} />);
    expect(screen.getByText('1.5x')).toBeInTheDocument();
  });

  it('isSuspended 为 true 时显示"已暂停"', () => {
    renderWithIntl(<UserProfileCard user={createUser({ isSuspended: true })} />);
    expect(screen.getByText('已暂停')).toBeInTheDocument();
  });

  it('isSuspended 为 false 时显示"正常"', () => {
    renderWithIntl(<UserProfileCard user={createUser({ isSuspended: false })} />);
    expect(screen.getByText('正常')).toBeInTheDocument();
  });

  it('createdAt 缺失时兜底显示占位符', () => {
    renderWithIntl(<UserProfileCard user={createUser({ createdAt: null })} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
