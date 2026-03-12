import Link from 'next/link';
import { Lightning, CurrencyDollar, ShieldCheck, ChartLineUp } from '@phosphor-icons/react/dist/ssr';

const FEATURES = [
  {
    icon: Lightning,
    title: '多模型支持',
    description: '一个 API Key 访问 OpenAI、Gemini、Claude 等主流模型，兼容 OpenAI API 格式，也支持原生 API 透传。',
  },
  {
    icon: CurrencyDollar,
    title: '智能计费',
    description: '按实际 token 用量精确计费，支持自定义加价倍率。管理员可随时调整模型定价。',
  },
  {
    icon: ChartLineUp,
    title: '实时监控',
    description: '完整的用量统计和消费明细，支持按用户、模型、日期筛选。消费告警自动通知。',
  },
  {
    icon: ShieldCheck,
    title: '安全可靠',
    description: '通过 Cloudflare AI Gateway 代理，全球边缘节点加速。支持并发限制和消费上限。',
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">MUI Router</h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            统一 AI API 网关，一个 Key 调用所有模型。
            <br />
            支持 OpenAI、Gemini、Claude，按量计费，实时监控。
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              免费注册
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-lg border border-border px-6 text-sm font-medium hover:bg-accent transition-colors"
            >
              登录
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-12">为什么选择 MUI Router</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4 p-6 rounded-xl border border-border bg-card">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon size={20} className="text-primary" weight="duotone" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 border-t border-border">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold mb-4">开始使用</h2>
          <p className="text-muted-foreground mb-8">注册即可获取 API Key，立即开始调用 AI 模型。</p>
          <Link
            href="/register"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            立即注册
          </Link>
        </div>
      </section>
    </div>
  );
}
