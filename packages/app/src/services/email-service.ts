import { Resend } from 'resend';

export interface EmailConfig {
  apiKey: string;
  fromEmail?: string;
  fromName?: string;
}

/**
 * 邮件服务：使用 Resend 发送邮件
 */
export class EmailService {
  private resend: Resend;
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor(config: EmailConfig) {
    this.resend = new Resend(config.apiKey);
    this.apiKey = config.apiKey;
    this.fromEmail = config.fromEmail ?? 'noreply@example.com';
    this.fromName = config.fromName ?? 'Uni-Gateway';
  }

  /**
   * 统一发送入口：未配置 API Key 时跳过（不发起网络请求），异常吞掉返回 false
   */
  private async send(params: { to: string; subject: string; html: string }): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('RESEND_API_KEY 未配置，跳过邮件发送:', params.subject);
      return false;
    }
    try {
      await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      return true;
    } catch (error) {
      console.error('发送邮件失败:', params.subject, error);
      return false;
    }
  }

  /**
   * 发送欢迎邮件（新用户）
   */
  async sendWelcomeEmail(email: string, amount: number, dashboardUrl: string): Promise<boolean> {
    return this.send({
      to: email,
      subject: '欢迎使用 Uni-Gateway',
      html: this.getWelcomeEmailHtml(amount, dashboardUrl),
    });
  }

  /**
   * 发送充值成功邮件（老用户）
   */
  async sendRechargeSuccessEmail(email: string, amount: number, newBalance: number): Promise<boolean> {
    return this.send({
      to: email,
      subject: '💰 充值成功 - Uni-Gateway',
      html: this.getRechargeSuccessEmailHtml(amount, newBalance),
    });
  }

  /**
   * 发送告警邮件（消费限额、全局阈值等）
   */
  async sendAlertEmail(to: string, subject: string, message: string): Promise<boolean> {
    return this.send({
      to,
      subject,
      html: this.getAlertEmailHtml(subject, message),
    });
  }

  private getAlertEmailHtml(title: string, message: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; background: #FEF2F2; border-radius: 8px; }
    .content { background: #FFF7ED; border: 1px solid #F59E0B; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${title}</h2>
    </div>
    <div class="content">
      <p>${message}</p>
    </div>
    <p>请登录管理后台查看详情并采取措施。</p>
    <div class="footer">
      <p>Uni-Gateway - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getWelcomeEmailHtml(amount: number, dashboardUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: #10B981; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>欢迎使用 Uni-Gateway</h1>
    </div>

    <p>你好！</p>
    <p>感谢你的支持！你的账户已创建成功，初始余额：</p>

    <div class="amount">$${amount.toFixed(2)}</div>

    <p>请登录 Dashboard 创建你的 API Key：</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" class="button">前往 Dashboard</a>
    </div>

    <p>如有任何问题，请回复此邮件联系我们。</p>

    <div class="footer">
      <p>Uni-Gateway - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getRechargeSuccessEmailHtml(amount: number, newBalance: number): string {
    return `
<!DOCTYPE html>
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
      <h1>💰 充值成功</h1>
    </div>

    <p>你好！</p>
    <p>感谢你的持续支持！你的充值已成功到账。</p>

    <div class="amount">+$${amount.toFixed(2)}</div>

    <div class="balance">
      <p style="margin: 0; color: #666;">当前余额</p>
      <p style="margin: 5px 0 0; font-size: 24px; font-weight: bold;">$${newBalance.toFixed(2)}</p>
    </div>

    <p>你可以继续使用你的 API Key 调用服务。</p>
    <p>再次感谢你的支持！🙏</p>

    <div class="footer">
      <p>Uni-Gateway - 统一 AI 接口网关</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
