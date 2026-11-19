export function SummaryPanel({ title, description }: { title: string; description: string }) {
  return (
    // select-none：纯说明面板不可交互，消除移动端点击误选文字的"看起来能点"暗示（issue #18）
    <div className="select-none rounded-2xl border border-border/70 bg-background/80 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
