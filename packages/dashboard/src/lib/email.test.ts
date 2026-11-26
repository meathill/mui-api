import { describe, expect, it, vi } from 'vitest';
import { createEmailService } from './email';

function createSendMock() {
  return vi
    .fn<(message: EmailMessageBuilder) => Promise<EmailSendResult>>()
    .mockResolvedValue({ messageId: 'test-id' });
}

describe('createEmailService', () => {
  it('通过 Cloudflare Email binding 发送 OTP，并同时提供 text/html', async () => {
    const send = createSendMock();
    const service = createEmailService({ sendEmail: send, fromEmail: 'support@muirouter.com' });

    await service.sendOtpEmail('user@example.com', '123456');

    expect(send).toHaveBeenCalledOnce();
    const message = send.mock.calls[0][0];
    expect(message.from).toEqual({ email: 'support@muirouter.com', name: 'MuiRouter' });
    expect(message.to).toBe('user@example.com');
    expect(message.subject).toContain('MuiRouter');
    expect(message.text).toContain('123456');
    expect(message.html).toContain('123456');
  });

  it('充值邮件发送失败时返回 false，不抛出异常', async () => {
    const send = createSendMock().mockRejectedValue(new Error('send failed'));
    const service = createEmailService({ sendEmail: send, fromEmail: 'support@muirouter.com' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(service.sendRechargeSuccessEmail('user@example.com', 10, 20)).resolves.toBe(false);
    consoleError.mockRestore();
  });
});
