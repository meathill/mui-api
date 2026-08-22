'use client';

import mermaid from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';

interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [hasError, setHasFailed] = useState<boolean>(false);
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    function syncTheme() {
      setIsDark(root.classList.contains('dark'));
    }
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function renderChart() {
      if (!chart.trim()) {
        return;
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: isDark ? 'dark' : 'neutral',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: '#18181b',
                primaryColor: '#27272a',
                primaryTextColor: '#f4f4f5',
                primaryBorderColor: '#3f3f46',
                lineColor: '#a1a1aa',
                secondaryColor: '#1e293b',
                tertiaryColor: '#0f172a',
              }
            : {
                darkMode: false,
                background: '#f8fafc',
                primaryColor: '#f1f5f9',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#cbd5e1',
                lineColor: '#64748b',
                secondaryColor: '#f8fafc',
                tertiaryColor: '#ffffff',
              },
          fontFamily: 'inherit',
        });

        const renderId = `${id}-${isDark ? 'dark' : 'light'}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, chart);

        if (!isCancelled) {
          setSvgHtml(svg);
          setHasFailed(false);
        }
      } catch (error) {
        console.error('[Mermaid] render error:', error);
        if (!isCancelled) {
          setHasFailed(true);
        }
      }
    }

    renderChart();

    return () => {
      isCancelled = true;
    };
  }, [chart, id, isDark]);

  if (hasError) {
    return (
      <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-foreground p-5 text-sm leading-7 text-background">
        <code>{chart}</code>
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-8 flex w-full justify-center overflow-x-auto rounded-xl border border-border bg-card/60 p-6 shadow-xs backdrop-blur-xs [&>svg]:h-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
