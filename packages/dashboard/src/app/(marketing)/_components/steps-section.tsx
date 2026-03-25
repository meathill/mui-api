import { UserPlusIcon, CreditCardIcon, RocketIcon } from 'lucide-react';

const STEPS = [
  {
    icon: UserPlusIcon,
    step: '01',
    title: '注册账号',
    description: '邮箱注册，30 秒完成。立即获得专属 API Key。',
  },
  {
    icon: CreditCardIcon,
    step: '02',
    title: '充值余额',
    description: '按需充值，最低 ¥10 起。支持微信、支付宝。',
  },
  {
    icon: RocketIcon,
    step: '03',
    title: '开始调用',
    description: '替换 Base URL，现有代码无需任何修改。',
  },
];

export function StepsSection() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">三步开始</h2>
          <p className="mt-3 text-muted-foreground text-lg">从注册到调用，最快 1 分钟</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                <item.icon size={24} className="text-primary" />
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-2">STEP {item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
