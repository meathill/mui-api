/**
 * 邮件服务
 * 从 packages/app/src/services/email-service.ts 搬移
 */
import { Resend } from 'resend';

interface EmailConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
}

export function createEmailService(config: EmailConfig) {
  const resend = new Resend(config.apiKey);
  const fromEmail = config.fromEmail ?? 'noreply@example.com';
  const fromName = config.fromName ?? 'MUI Router';
  const from = `${fromName} <${fromEmail}>`;

  return {
    async sendClaimEmail(email: string, claimUrl: string): Promise<boolean> {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: '领取你的 API Key - MUI Router',
          html: getClaimEmailHtml(claimUrl),
        });
        return true;
      } catch (error) {
        console.error('发送 Claim 邮件失败:', error);
        return false;
      }
    },

    async sendRechargeSuccessEmail(email: string, amount: number, newBalance: number): Promise<boolean> {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: '充值成功 - MUI Router',
          html: getRechargeSuccessEmailHtml(amount, newBalance),
        });
        return true;
      } catch (error) {
        console.error('发送充值成功邮件失败:', error);
        return false;
      }
    },
  };
}

function getClaimEmailHtml(claimUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .warning { background: #FEF3C7; border: 1px solid #F59E0B; padding: 12px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>欢迎使用 MUI Router</h1>
    </div>
    <p>你好！</p>
    <p>感谢你的支持！你的账户已创建成功，现在可以领取你的 API Key。</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${claimUrl}" class="button">领取 API Key</a>
    </div>
    <div class="warning">
      <strong>重要提示</strong>：API Key 仅显示一次，请务必立即保存。链接有效期 15 分钟。
    </div>
    <p>如有任何问题，请回复此邮件联系我们。</p>
    <div class="footer">
      <p>MUI Router - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>`;
}

function getRechargeSuccessEmailHtml(amount: number, newBalance: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: #10B981; text-align: center; }
    .balance { background: #F3F4F6; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>充值成功</h1>
    </div>
    <p>你好！</p>
    <p>感谢你的持续支持！你的充值已成功到账。</p>
    <div class="amount">+$${amount.toFixed(2)}</div>
    <div class="balance">
      <p style="margin: 0; color: #666;">当前余额</p>
      <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold;">$${newBalance.toFixed(2)}</p>
    </div>
    <p>你可以继续使用你的 API Key 调用服务。</p>
    <div class="footer">
      <p>MUI Router - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>`;
}
