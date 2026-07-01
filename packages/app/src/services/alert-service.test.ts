import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from './alert-service';

function createMockKvService() {
  return {
    incrementUserMonthlySpending: vi.fn().mockResolvedValue(0),
    incrementGlobalSpending: vi.fn().mockResolvedValue(0),
    getGlobalConfig: vi.fn().mockResolvedValue(null),
    setGlobalConfig: vi.fn(),
  };
}

function createMockWalletService() {
  return {
    suspend: vi.fn(),
  };
}

function createMockDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(null),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  };
}

function createMockEmailService() {
  return {
    sendAlertEmail: vi.fn(),
  };
}

describe('AlertService', () => {
  let kvService: ReturnType<typeof createMockKvService>;
  let db: ReturnType<typeof createMockDb>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let walletService: ReturnType<typeof createMockWalletService>;
  let service: AlertService;

  beforeEach(() => {
    kvService = createMockKvService();
    db = createMockDb();
    emailService = createMockEmailService();
    walletService = createMockWalletService();
    service = new AlertService(
      kvService as never,
      db as never,
      emailService as never,
      'admin@test.com',
      walletService as never,
    );
  });

  describe('checkAfterBilling', () => {
    it('无限额配置时不触发告警', async () => {
      await service.checkAfterBilling('user-1', 0.5);
      expect(emailService.sendAlertEmail).not.toHaveBeenCalled();
    });

    it('消费达 100% 时暂停用户', async () => {
      // 模拟有限额配置
      const mockGet = vi.fn().mockResolvedValue({
        monthlyLimit: 10,
        alertThreshold: 0.8,
        lastAlertAt: null,
      });
      db.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockGet,
          })),
        })),
      });
      // 月度消费已达限额
      kvService.incrementUserMonthlySpending.mockResolvedValue(10);

      await service.checkAfterBilling('user-1', 1);

      expect(walletService.suspend).toHaveBeenCalledWith('user-1');
      expect(emailService.sendAlertEmail).toHaveBeenCalled();
    });

    it('消费达阈值时发送告警（无冷却期）', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        monthlyLimit: 100,
        alertThreshold: 0.8,
        lastAlertAt: null,
      });
      db.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockGet,
          })),
        })),
      });
      // 月度消费达 85%
      kvService.incrementUserMonthlySpending.mockResolvedValue(85);

      await service.checkAfterBilling('user-1', 5);

      expect(walletService.suspend).not.toHaveBeenCalled();
      expect(emailService.sendAlertEmail).toHaveBeenCalled();
    });

    it('冷却期内不重复发送告警', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        monthlyLimit: 100,
        alertThreshold: 0.8,
        lastAlertAt: new Date(), // 刚发送过
      });
      db.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockGet,
          })),
        })),
      });
      kvService.incrementUserMonthlySpending.mockResolvedValue(85);

      await service.checkAfterBilling('user-1', 5);

      expect(emailService.sendAlertEmail).not.toHaveBeenCalled();
    });

    it('全局日消费上限触发暂停', async () => {
      kvService.getGlobalConfig.mockResolvedValue({
        dailySpendingCap: 50,
        monthlySpendingCap: 0,
        adminEmail: 'admin@test.com',
        isServicePaused: false,
      });
      kvService.incrementGlobalSpending.mockResolvedValue(50);

      await service.checkAfterBilling('user-1', 5);

      expect(kvService.setGlobalConfig).toHaveBeenCalledWith(expect.objectContaining({ isServicePaused: true }));
      expect(emailService.sendAlertEmail).toHaveBeenCalled();
    });
  });
});
