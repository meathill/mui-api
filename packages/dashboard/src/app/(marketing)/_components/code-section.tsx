const CODE_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-mui-router-key",
    base_url="https://your-domain.com/v1",
)

# 就这么简单，和直接用 OpenAI 完全一样
response = client.chat.completions.create(
    model="gpt-4o",          # 或 claude-sonnet, gemini-pro
    messages=[{"role": "user", "content": "你好"}],
)

print(response.choices[0].message.content)`;

export function CodeSection() {
  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">接入就是这么简单</h2>
          <p className="mt-3 text-muted-foreground text-lg">已有 OpenAI SDK 代码？只需修改两行</p>
        </div>

        <div className="rounded-xl border border-border bg-[#0d1117] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <span className="ml-2 text-xs text-white/40 font-mono">example.py</span>
          </div>
          <pre className="p-6 overflow-x-auto text-sm leading-relaxed">
            <code className="text-[#e6edf3] font-mono whitespace-pre">{CODE_EXAMPLE}</code>
          </pre>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          同样支持 Node.js、curl、以及任何兼容 OpenAI API 的工具和框架
        </p>
      </div>
    </section>
  );
}
