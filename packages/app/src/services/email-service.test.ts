import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailService } from './email-service';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: vi.fn(function ResendMock() {
    return { emails: { send: sendMock } };
  }),
}));

describe('EmailService', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: 'email-id' });
  });

  it('sendWelcomeEmail：成功返回 true，from/to/subject 正确', async () => {
    const service = new EmailService({ apiKey: 'k' });
    const ok = await service.sendWelcomeEmail('user@example.com', 5, 'https://dash');
    expect(ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.from).toBe('Uni-Gateway <noreply@example.com>');
    expect(arg.to).toBe('user@example.com');
    expect(arg.subject).toBe('欢迎使用 Uni-Gateway');
    expect(arg.html).toContain('$5.00');
    expect(arg.html).toContain('https://dash');
  });

  it('sendRechargeSuccessEmail：成功返回 true，含金额与余额', async () => {
    const service = new EmailService({ apiKey: 'k' });
    const ok = await service.sendRechargeSuccessEmail('user@example.com', 20, 30);
    expect(ok).toBe(true);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.subject).toBe('💰 充值成功 - Uni-Gateway');
    expect(arg.html).toContain('+$20.00');
    expect(arg.html).toContain('$30.00');
  });

  it('sendAlertEmail：透传 subject 与 message', async () => {
    const service = new EmailService({ apiKey: 'k' });
    const ok = await service.sendAlertEmail('admin@example.com', '消费告警', '已超过每日上限');
    expect(ok).toBe(true);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe('admin@example.com');
    expect(arg.subject).toBe('消费告警');
    expect(arg.html).toContain('已超过每日上限');
  });

  it('自定义 fromEmail / fromName 反映到 from 字段', async () => {
    const service = new EmailService({ apiKey: 'k', fromEmail: 'hi@muirouter.com', fromName: 'MuiRouter' });
    await service.sendAlertEmail('a@b.com', 's', 'm');
    expect(sendMock.mock.calls[0][0].from).toBe('MuiRouter <hi@muirouter.com>');
  });

  it('apiKey 缺失时跳过发送、不发起网络请求并返回 false', async () => {
    const service = new EmailService({ apiKey: '' });
    expect(await service.sendWelcomeEmail('u@e.com', 1, 'd')).toBe(false);
    expect(await service.sendRechargeSuccessEmail('u@e.com', 1, 2)).toBe(false);
    expect(await service.sendAlertEmail('u@e.com', 's', 'm')).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('Resend 抛错时各方法吞掉异常并返回 false', async () => {
    sendMock.mockRejectedValue(new Error('boom'));
    const service = new EmailService({ apiKey: 'k' });
    expect(await service.sendWelcomeEmail('u@e.com', 1, 'd')).toBe(false);
    expect(await service.sendRechargeSuccessEmail('u@e.com', 1, 2)).toBe(false);
    expect(await service.sendAlertEmail('u@e.com', 's', 'm')).toBe(false);
  });
});
