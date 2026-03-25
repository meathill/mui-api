import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';

const STATS = [
  { value: '3', label: '主流 AI 厂商' },
  { value: '100%', label: 'OpenAI 兼容' },
  { value: '300+', label: 'Cloudflare 节点' },
  { value: '¥0', label: '月费 / 订阅费' },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 px-6 sm:py-32">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          OpenAI / Claude / Gemini 全部支持
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">
          一个 Key，调用
          <span className="text-primary">所有 AI 模型</span>
        </h1>

        <p className="mt-6 text-lg text-muted-foreground leading-relaxed sm:text-xl max-w-2xl mx-auto">
          无需翻墙，无需注册海外账号。充值即用，按 token 计费，没有月费和订阅。
          <br className="hidden sm:block" />
          兼容 OpenAI SDK，换个 Base URL 就能用。
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            免费注册，立即开始
            <ArrowRightIcon size={18} />
          </Link>
          <Link
            href="#pricing"
            className="inline-flex h-12 items-center rounded-lg border border-border px-8 text-base font-medium hover:bg-accent transition-colors"
          >
            查看定价
          </Link>
        </div>

        {/* 信任指标 */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
