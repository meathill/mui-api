import Link from 'next/link';
import { ArrowRightIcon } from 'lucide-react';

export function CtaSection() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">别再折腾 VPN 和海外信用卡了</h2>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          注册即可获取 API Key，充值后立即开始调用。
          <br />
          支持所有主流 AI 模型，按量计费，用多少花多少。
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            免费注册
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
