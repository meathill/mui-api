// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render-with-intl';
import { AwesomeComment } from './awesome-comment';

const remote = vi.hoisted(() => ({
  getInstance: vi.fn(() => ({ kind: 'auth-instance' })),
  init: vi.fn(),
}));

// URL 必须与组件里的 import() 字面量逐字一致。
// 工厂只执行一次且结果被缓存，所以失败场景不能在这里抛，要靠 mockImplementation 现场改。
vi.mock('https://unpkg.com/@roudanio/awesome-auth@0.1.5/dist/awesome-auth.js', () => ({
  getInstance: remote.getInstance,
}));

vi.mock('https://unpkg.com/@roudanio/awesome-comment@0.10.10/dist/awesome-comment.js', () => ({
  default: { init: remote.init },
}));

/** 捕获 IntersectionObserver 回调，让测试自己决定何时"滚入视口"。 */
let triggerIntersect: ((isIntersecting: boolean) => void) | null = null;
let disconnectCount = 0;

beforeEach(() => {
  vi.clearAllMocks();
  remote.getInstance.mockReturnValue({ kind: 'auth-instance' });
  triggerIntersect = null;
  disconnectCount = 0;
  document.documentElement.classList.remove('dark');
  window.history.replaceState({}, '', '/zh/blog/gpt-5-6');

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        triggerIntersect = (isIntersecting) => {
          callback([{ isIntersecting }]);
        };
      }
      observe() {}
      disconnect() {
        disconnectCount += 1;
      }
      unobserve() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

async function scrollIntoView() {
  await act(async () => {
    triggerIntersect?.(true);
  });
}

describe('AwesomeComment', () => {
  it('渲染标题与挂载点', () => {
    renderWithIntl(<AwesomeComment />);

    expect(screen.getByRole('heading', { name: '评论' })).toBeInTheDocument();
    expect(document.getElementById('awesome-comment')).toBeInTheDocument();
  });

  it('未进入视口时不加载 widget', () => {
    renderWithIntl(<AwesomeComment />);

    expect(remote.init).not.toHaveBeenCalled();
  });

  it('滚入视口后按正确参数初始化', async () => {
    renderWithIntl(<AwesomeComment />);
    await scrollIntoView();

    await waitFor(() => expect(remote.init).toHaveBeenCalledTimes(1));

    const [target, options] = remote.init.mock.calls[0] as [HTMLElement, Record<string, unknown>];
    expect(target.id).toBe('awesome-comment');
    expect(options.siteId).toBeTruthy();
    expect(options.apiUrl).toBe('https://awesomecomment.org');
    // 跟随页面语言，不是 navigator.language。且 zh 必须映射成 zh-CN——
    // widget 的 zh 是繁体，本站是简体，直接透传会简繁混排
    expect(options.locale).toBe('zh-CN');
    // 按语种隔离：带 /zh 前缀的路径与英文版是两条独立线程
    expect(options.postId).toBe('/zh/blog/gpt-5-6');
    // 不开匿名评论
    expect(options).not.toHaveProperty('turnstileSiteKey');

    expect(remote.getInstance).toHaveBeenCalledWith(
      expect.objectContaining({ root: 'https://awesomecomment.org/api/site/auth', prefix: 'acSaas' }),
    );
  });

  it('重复进入视口只初始化一次', async () => {
    renderWithIntl(<AwesomeComment />);
    await scrollIntoView();
    await waitFor(() => expect(remote.init).toHaveBeenCalledTimes(1));

    await scrollIntoView();
    await scrollIntoView();

    expect(remote.init).toHaveBeenCalledTimes(1);
    expect(disconnectCount).toBeGreaterThan(0);
  });

  it('data-theme 初始跟随 html 的 dark class', () => {
    document.documentElement.classList.add('dark');
    renderWithIntl(<AwesomeComment />);

    expect(document.getElementById('awesome-comment')).toHaveAttribute('data-theme', 'dark');
  });

  it('站内切换主题时 data-theme 实时翻面', async () => {
    renderWithIntl(<AwesomeComment />);
    expect(document.getElementById('awesome-comment')).toHaveAttribute('data-theme', 'light');

    await act(async () => {
      document.documentElement.classList.add('dark');
      // MutationObserver 是微任务，让它跑完
      await Promise.resolve();
    });
    await waitFor(() => expect(document.getElementById('awesome-comment')).toHaveAttribute('data-theme', 'dark'));

    await act(async () => {
      document.documentElement.classList.remove('dark');
      await Promise.resolve();
    });
    await waitFor(() => expect(document.getElementById('awesome-comment')).toHaveAttribute('data-theme', 'light'));
  });

  it('远程模块加载失败时给出提示而不是空白', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    remote.getInstance.mockImplementation(() => {
      throw new Error('network down');
    });

    renderWithIntl(<AwesomeComment />);
    await scrollIntoView();

    await waitFor(() => expect(screen.getByText(/评论加载失败/)).toBeInTheDocument());
    expect(remote.init).not.toHaveBeenCalled();
  });
});
