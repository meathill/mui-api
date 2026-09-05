import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connect, normalizeRepository } from './connect.ts';
import { upgrade } from './commands.ts';
import { loginPath, projectKeyPath, readManifest, runtimeCredential, saveJson } from './storage.ts';

let directory: string;
let root: string;
const calls: Array<{ operation: string; body: Record<string, unknown> }> = [];
let failInstall = false;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'muirouter-cli-test-'));
  root = path.join(directory, 'repository');
  vi.stubEnv('MUIROUTER_CONFIG_DIR', path.join(directory, 'credentials'));
  vi.stubEnv('CODEX_HOME', path.join(directory, 'codex'));
  await saveJson(path.join(root, 'package.json'), { name: 'test-app' });
  await saveJson(
    loginPath(),
    {
      apiBaseUrl: 'https://api.muirouter.com',
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() + 3600_000,
    },
    true,
  );
  calls.length = 0;
  failInstall = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const operation = new URL(url).pathname.split('/').at(-1) ?? '';
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      calls.push({ operation, body });
      if (operation === 'get_service_info') return Response.json({ canManageInternal: true });
      if (operation === 'ensure_project' || operation === 'get_project')
        return Response.json({ project: { id: 'project-test', name: 'test-app' } });
      if (operation === 'get_upgrade_plan') return Response.json({ currentVersion: '1.0.0', needsUpgrade: true });
      if (operation === 'install_project_key') {
        if (failInstall) throw new Error('模拟响应丢失');
        return Response.json({ keyId: body.keyId });
      }
      throw new Error(`意外 API 调用：${operation}`);
    }),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe('CLI 接入', () => {
  it('重复接入不重复建项目、不换 key，输出和 Git 配置均无秘密', async () => {
    const first = await connect(root);
    const credential = await readFile(projectKeyPath('project-test'), 'utf8');
    const second = await connect(root);
    expect(second.projectId).toBe(first.projectId);
    expect(calls.filter((call) => call.operation === 'ensure_project')).toHaveLength(1);
    expect(await readFile(projectKeyPath('project-test'), 'utf8')).toBe(credential);
    expect((await stat(projectKeyPath('project-test'))).mode & 0o777).toBe(0o600);
    const rawKey = (JSON.parse(credential) as { rawKey: string }).rawKey;
    expect(JSON.stringify([calls, first, second])).not.toContain(rawKey);
    expect(await readFile(path.join(root, '.muirouter.json'), 'utf8')).not.toContain(rawKey);
    expect(await readFile(path.join(directory, 'codex/skills/muirouter-integration/SKILL.md'), 'utf8')).toContain(
      '接入 MuiRouter',
    );
  });

  it('安装响应丢失后重试使用原哈希，不新增孤立 key', async () => {
    failInstall = true;
    await expect(connect(root)).rejects.toThrow('模拟响应丢失');
    failInstall = false;
    await connect(root);
    const installs = calls.filter((call) => call.operation === 'install_project_key');
    expect(installs).toHaveLength(2);
    expect(installs[0]?.body.keyId).toBe(installs[1]?.body.keyId);
  });

  it('升级保留项目显式模型与自定义字段', async () => {
    await connect(root);
    const manifest = await readManifest(root);
    await saveJson(path.join(root, '.muirouter.json'), {
      ...manifest,
      version: '1.0.0',
      models: { chat: 'my-model' },
      userNote: '不要覆盖',
    });
    await upgrade(root);
    expect(JSON.parse(await readFile(path.join(root, '.muirouter.json'), 'utf8'))).toMatchObject({
      models: { chat: 'my-model' },
      userNote: '不要覆盖',
    });
  });

  it('仓库修改 API 端点不能带走已有凭证', async () => {
    await connect(root);
    const manifest = await readManifest(root);
    if (!manifest) throw new Error('缺少 manifest');
    await expect(runtimeCredential({ ...manifest, apiBaseUrl: 'https://evil.example.com' })).rejects.toThrow('不一致');
  });

  it('仓库身份不包含 remote 用户名、密码或查询参数', () => {
    expect(normalizeRepository('https://user:secret@github.com/team/repo.git?token=hidden')).toBe(
      'github.com/team/repo',
    );
    expect(normalizeRepository('git@github.com:team/repo.git')).toBe('github.com/team/repo');
  });
});
