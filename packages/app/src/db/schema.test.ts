import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  models,
  rechargeLogs,
  spendingLimits,
  stripeTopupSessions,
  usageLogs,
  usageStats,
  users,
  wallets,
} from './schema';

describe('Database Schema', () => {
  describe('users alias table', () => {
    it('should have correct table name', () => {
      expect(getTableName(users)).toBe('user');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(users);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('emailVerified');
      expect(columnNames).toContain('image');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });
  });

  describe('wallets table', () => {
    it('should have correct table name', () => {
      expect(getTableName(wallets)).toBe('wallets');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(wallets);
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('balance');
      expect(columnNames).toContain('currency');
      expect(columnNames).toContain('updatedAt');
    });
  });

  describe('models table', () => {
    it('should have correct table name', () => {
      expect(getTableName(models)).toBe('models');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(models);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('provider');
      expect(columnNames).toContain('upstreamModelId');
      expect(columnNames).toContain('inputPrice');
      expect(columnNames).toContain('outputPrice');
      expect(columnNames).toContain('markupRate');
    });
  });

  describe('usageLogs table', () => {
    it('should have correct table name', () => {
      expect(getTableName(usageLogs)).toBe('usage_logs');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(usageLogs);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('apiKeyId');
      expect(columnNames).toContain('modelId');
      expect(columnNames).toContain('inputTokens');
      expect(columnNames).toContain('outputTokens');
      expect(columnNames).toContain('cost');
    });
  });

  describe('usageStats table', () => {
    it('should have correct table name', () => {
      expect(getTableName(usageStats)).toBe('usage_stats');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(usageStats);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('granularity');
      expect(columnNames).toContain('periodStart');
      expect(columnNames).toContain('periodEnd');
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('modelId');
      expect(columnNames).toContain('totalCost');
      expect(columnNames).toContain('totalInputTokens');
      expect(columnNames).toContain('totalOutputTokens');
      expect(columnNames).toContain('requestCount');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });
  });

  describe('rechargeLogs table', () => {
    it('should have correct table name', () => {
      expect(getTableName(rechargeLogs)).toBe('recharge_logs');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(rechargeLogs);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('operatorId');
      expect(columnNames).toContain('amount');
      expect(columnNames).toContain('balanceAfter');
      expect(columnNames).toContain('source');
      expect(columnNames).toContain('sourceId');
      expect(columnNames).toContain('note');
      expect(columnNames).toContain('createdAt');
    });
  });

  describe('stripeTopupSessions table', () => {
    it('should have correct table name', () => {
      expect(getTableName(stripeTopupSessions)).toBe('stripe_topup_sessions');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(stripeTopupSessions);
      expect(columnNames).toContain('checkoutSessionId');
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('amount');
      expect(columnNames).toContain('currency');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('paymentStatus');
      expect(columnNames).toContain('stripeCustomerId');
      expect(columnNames).toContain('paymentIntentId');
      expect(columnNames).toContain('balanceAfter');
      expect(columnNames).toContain('lastError');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
      expect(columnNames).toContain('completedAt');
    });
  });

  describe('spendingLimits table', () => {
    it('should have correct table name', () => {
      expect(getTableName(spendingLimits)).toBe('spending_limits');
    });

    it('should have required columns', () => {
      const columnNames = Object.keys(spendingLimits);
      expect(columnNames).toContain('userId');
      expect(columnNames).toContain('monthlyLimit');
      expect(columnNames).toContain('alertThreshold');
      expect(columnNames).toContain('isSuspended');
    });
  });
});
