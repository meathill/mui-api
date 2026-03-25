import { GlobeIcon, WalletIcon, CodeIcon, ArrowLeftRightIcon } from 'lucide-react';

const ADVANTAGES = [
  {
    icon: GlobeIcon,
    title: '无需翻墙',
    description: '通过 Cloudflare 全球边缘网络代理，国内直连无障碍。无需海外信用卡，无需注册海外账号。',
  },
  {
    icon: WalletIcon,
    title: '按量付费',
    description: '没有月费，没有订阅。充值到钱包，用多少扣多少。余额永不过期，随时可查消费明细。',
  },
  {
    icon: CodeIcon,
    title: 'OpenAI 兼容',
    description: '完全兼容 OpenAI SDK 和 API 格式。已有项目只需修改 Base URL 和 API Key，零成本迁移。',
  },
  {
    icon: ArrowLeftRightIcon,
    title: '原生 API 透传',
    description: '同时支持各厂商原生 API，保留全部参数和功能。Claude 的长上下文、Gemini 的多模态，一个不落。',
  },
];

export function AdvantagesSection() {
  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">为什么选择 MUI Router</h2>
          <p className="mt-3 text-muted-foreground text-lg">专为国内开发者打造的 AI API 网关</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ADVANTAGES.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card p-6">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <item.icon size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
