/**
 * 邮件服务：通过 Cloudflare Email Service 的 Workers binding 发送事务邮件。
 */
import { formatBalance } from '@muirouter/shared-db/money';

interface EmailConfig {
  sendEmail: (message: EmailMessageBuilder) => Promise<EmailSendResult>;
  fromEmail: string;
  fromName?: string;
}

export function createEmailService(config: EmailConfig) {
  const from = { email: config.fromEmail, name: config.fromName ?? 'MuiRouter' };

  return {
    async sendOtpEmail(email: string, otp: string): Promise<void> {
      await config.sendEmail({
        from,
        to: email,
        subject: 'MuiRouter 登录验证码 / Sign-in code',
        text: getOtpEmailText(otp),
        html: getOtpEmailHtml(otp),
      });
    },
    async sendRechargeSuccessEmail(email: string, amount: number, newBalance: number): Promise<boolean> {
      try {
        await config.sendEmail({
          from,
          to: email,
          subject: '充值成功 - MuiRouter',
          text: getRechargeSuccessEmailText(amount, newBalance),
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

function getOtpEmailText(otp: string): string {
  return `您的 MuiRouter 验证码是：${otp}\n有效期 5 分钟。如非本人操作，请忽略此邮件。\n\nYour MuiRouter verification code is ${otp}.\nIt expires in 5 minutes. If you did not request it, please ignore this email.`;
}

function getOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MuiRouter 登录验证码</title>
</head>
<body style="margin:0;background:#faf7ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#3a2e23;">
  <main style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 24px;">登录 MuiRouter</h1>
    <p style="font-size:16px;line-height:1.7;margin:0 0 16px;">您的验证码是：</p>
    <p style="font-size:36px;font-weight:700;letter-spacing:8px;margin:0 0 24px;">${otp}</p>
    <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">验证码 5 分钟内有效。如非本人操作，请忽略此邮件。</p>
    <hr style="border:0;border-top:1px solid #e7dfd0;margin:28px 0;">
    <p style="font-size:14px;line-height:1.7;margin:0 0 8px;">Your MuiRouter verification code is:</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:0 0 16px;">${otp}</p>
    <p style="font-size:13px;line-height:1.7;margin:0;">It expires in 5 minutes. If you did not request it, please ignore this email.</p>
  </main>
</body>
</html>`;
}

function getRechargeSuccessEmailText(amount: number, newBalance: number): string {
  return `感谢你的持续支持！你的充值已成功到账。\n充值金额：$${formatBalance(amount)}\n当前余额：$${formatBalance(newBalance)}\n\nMuiRouter`;
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
    <div class="amount">+$${formatBalance(amount)}</div>
    <div class="balance">
      <p style="margin: 0; color: #666;">当前余额</p>
      <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold;">$${formatBalance(newBalance)}</p>
    </div>
    <p>你可以继续使用你的 API Key 调用服务。</p>
    <div class="footer">
      <p>MuiRouter - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>`;
}
