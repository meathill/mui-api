import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 本仓库 vitest 未开 globals，RTL 依赖全局 afterEach 的自动 cleanup 检测不到，
// 需要显式注册，否则同一测试文件里多次 render() 的 DOM 会堆积，导致 getByText 误判"多个匹配"。
afterEach(() => {
  cleanup();
});
