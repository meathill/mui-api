import { Hono } from "hono";
import type { CloudflareBindings } from "../types";
import { createDb } from "../db";
import { KeyService } from "../services/key-service";

const claim = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST /api/claim
 * 通过 Token 换取 API Key（一次性）
 */
claim.post("/api/claim", async (c) => {
  const body = await c.req.json<{ token: string }>();
  const { token } = body;

  if (!token) {
    return c.json({ error: "缺少 token 参数" }, 400);
  }

  const db = createDb(c.env.DB);
  const keyService = new KeyService(db);

  const result = await keyService.claimApiKey(token);

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({
    success: true,
    apiKey: result.rawKey,
  });
});

/**
 * GET /claim
 * 领卡页面
 */
claim.get("/claim", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.html(getErrorPage("无效的链接"));
  }

  return c.html(getClaimPage(token));
});

function getClaimPage(token: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>领取 API Key - Uni-Gateway</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { text-align: center; margin-bottom: 20px; font-size: 28px; }
    .loading { text-align: center; color: #666; }
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .success { display: none; }
    .error { display: none; color: #dc2626; text-align: center; padding: 20px; }
    .key-container {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
      position: relative;
    }
    .key-input {
      width: 100%;
      font-family: monospace;
      font-size: 14px;
      border: none;
      background: transparent;
      outline: none;
      word-break: break-all;
    }
    .copy-btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: #4F46E5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .copy-btn:hover { background: #4338CA; }
    .copy-btn.copied { background: #10B981; }
    .warning {
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      padding: 12px;
      border-radius: 8px;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔑 领取 API Key</h1>

    <div id="loading" class="loading">
      <div class="spinner"></div>
      <p>正在获取你的 API Key...</p>
    </div>

    <div id="success" class="success">
      <p style="text-align: center; color: #10B981; margin-bottom: 16px;">✅ 领取成功！</p>
      <div class="key-container">
        <input type="text" id="apiKey" class="key-input" readonly>
      </div>
      <button id="copyBtn" class="copy-btn" onclick="copyKey()">📋 一键复制</button>
      <div class="warning">
        ⚠️ <strong>重要</strong>：此 Key 仅显示一次，请立即保存。如遗失需联系管理员重置。
      </div>
    </div>

    <div id="error" class="error">
      <p id="errorMsg"></p>
      <p style="margin-top: 12px; font-size: 14px; color: #666;">链接已失效或已被使用，请检查邮件或联系客服。</p>
    </div>
  </div>

  <script>
    const token = "${token}";

    async function claimKey() {
      try {
        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await res.json();

        document.getElementById('loading').style.display = 'none';

        if (data.success) {
          document.getElementById('success').style.display = 'block';
          document.getElementById('apiKey').value = data.apiKey;
        } else {
          document.getElementById('error').style.display = 'block';
          document.getElementById('errorMsg').textContent = data.error || '领取失败';
        }
      } catch (err) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('errorMsg').textContent = '网络错误，请重试';
      }
    }

    function copyKey() {
      const keyInput = document.getElementById('apiKey');
      keyInput.select();
      document.execCommand('copy');

      const btn = document.getElementById('copyBtn');
      btn.textContent = '✅ 已复制';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = '📋 一键复制';
        btn.classList.remove('copied');
      }, 2000);
    }

    claimKey();
  </script>
</body>
</html>
  `.trim();
}

function getErrorPage(message: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>错误 - Uni-Gateway</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 { color: #dc2626; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ ${message}</h1>
    <p style="color: #666;">请检查邮件中的链接或联系客服。</p>
  </div>
</body>
</html>
  `.trim();
}

export default claim;
