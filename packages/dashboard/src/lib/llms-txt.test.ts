import { describe, expect, it } from 'vitest';
import { SITE_URL } from './seo';
import { buildLlmsFullTxt, buildLlmsTxt, createLlmsTxtResponse, LLMS_TXT_CACHE_CONTROL } from './llms-txt';

describe('llms.txt builders', () => {
  it('短版包含产品、关键页与 full 链接，不含具体价格数字', () => {
    const body = buildLlmsTxt();
    expect(body).toContain('# MuiRouter');
    expect(body).toContain('OpenAI-compatible');
    expect(body).toContain(`${SITE_URL}/pricing`);
    expect(body).toContain(`${SITE_URL}/mcp`);
    expect(body).toContain(`${SITE_URL}/llms-full.txt`);
    expect(body).toContain('MCP');
    // 不发明具体 token 单价
    expect(body).not.toMatch(/\$\d+\.\d+/);
  });

  it('完整版覆盖 API、定价策略与 MCP 工具，仍不列出具体单价', () => {
    const body = buildLlmsFullTxt();
    expect(body).toContain('https://api.muirouter.com/v1/chat/completions');
    expect(body).toContain('https://api.muirouter.com/v1/messages');
    expect(body).toContain('https://api.muirouter.com/mcp');
    expect(body).toContain('get_balance');
    expect(body).toContain('list_models');
    expect(body).toContain('No subscription');
    expect(body).toContain(`${SITE_URL}/pricing`);
    expect(body).not.toMatch(/\$\d+\.\d+/);
  });

  it('响应为 200 text/plain', () => {
    const response = createLlmsTxtResponse(buildLlmsTxt());
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe(LLMS_TXT_CACHE_CONTROL);
  });
});
