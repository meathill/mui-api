import { redirect } from 'next/navigation';

// 2026-09 去重：旧路径 /compare/openrouter 已合并至 /muirouter-vs-openrouter，保留 301
export default function CompareOpenrouterRedirect() {
  redirect('/muirouter-vs-openrouter');
}
