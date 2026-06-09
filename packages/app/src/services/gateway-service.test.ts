import { afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayService } from './gateway-service';

function makeService(mode?: 'unified' | 'byok', apiKey?: string): GatewayService {
  return new GatewayService('acct', 'gw', 'aig-token', 'cf-token', mode, apiKey);
}

function makeRequest(): Request {
  return new Request('https://client.example/proxy', {
    method: 'POST',
    headers: { authorization: 'Bearer client-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'x' }),
  });
}

function stubFetch() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function headersOf(fetchMock: ReturnType<typeof stubFetch>): Headers {
  const init = fetchMock.mock.calls[0]?.[1];
  return new Headers(init?.headers);
}

describe('GatewayService.proxyNative 凭证注入（只有 anthropic 走代付）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('anthropic + unified（默认）→ cf-aig-authorization + Authorization(CF_TOKEN)，不带 x-api-key', async () => {
    const fetchMock = stubFetch();
    await makeService().proxyNative('anthropic', 'v1/messages', makeRequest());

    const url = fetchMock.mock.calls[0]?.[0];
    expect(url).toBe('https://gateway.ai.cloudflare.com/v1/acct/gw/anthropic/v1/messages');
    const h = headersOf(fetchMock);
    expect(h.get('cf-aig-authorization')).toBe('Bearer aig-token');
    expect(h.get('authorization')).toBe('Bearer cf-token');
    expect(h.get('x-api-key')).toBeNull();
    expect(h.get('anthropic-version')).toBe('2023-06-01');
  });

  it('anthropic + byok → 注入 x-api-key，绝不带 Authorization', async () => {
    const fetchMock = stubFetch();
    await makeService('byok', 'sk-ant-mykey').proxyNative('anthropic', 'v1/messages', makeRequest());

    const h = headersOf(fetchMock);
    expect(h.get('x-api-key')).toBe('sk-ant-mykey');
    expect(h.get('authorization')).toBeNull();
    expect(h.get('cf-aig-authorization')).toBe('Bearer aig-token');
  });

  it('anthropic + byok 缺 ANTHROPIC_API_KEY → 抛错', async () => {
    stubFetch();
    await expect(makeService('byok').proxyNative('anthropic', 'v1/messages', makeRequest())).rejects.toThrow(
      '缺少 ANTHROPIC_API_KEY',
    );
  });

  it.each([
    'openai',
    'google-ai-studio',
    'workers-ai',
  ])('%s 不被注入任何代付凭证（杜绝误落 Unified Billing）', async (provider) => {
    const fetchMock = stubFetch();
    await makeService().proxyNative(provider, 'v1/x', makeRequest());

    const h = headersOf(fetchMock);
    expect(h.get('authorization')).toBeNull();
    expect(h.get('x-api-key')).toBeNull();
    expect(h.get('cf-aig-authorization')).toBe('Bearer aig-token');
  });

  it('剥离客户端 Authorization，不透传给上游', async () => {
    const fetchMock = stubFetch();
    await makeService().proxyNative('openai', 'v1/x', makeRequest());
    expect(headersOf(fetchMock).get('authorization')).toBeNull();
  });

  it('拒绝不支持的 provider', async () => {
    stubFetch();
    await expect(makeService().proxyNative('unknown', 'v1/x', makeRequest())).rejects.toThrow('不支持的 provider');
  });
});
