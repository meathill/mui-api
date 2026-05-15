'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'mui-theme';

function readStored(): Theme | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : null;
}

function readSystem(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setMounted(true);
    const initial = readStored() ?? readSystem();
    setTheme(initial);
    applyTheme(initial);

    // 没有手动选择时，跟随系统切换
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onSystemChange(e: MediaQueryListEvent) {
      if (readStored() === null) {
        const next: Theme = e.matches ? 'dark' : 'light';
        setTheme(next);
        applyTheme(next);
      }
    }
    mql.addEventListener('change', onSystemChange);
    return () => mql.removeEventListener('change', onSystemChange);
  }, []);

  function handleToggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const isDark = mounted && theme === 'dark';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      suppressHydrationWarning
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ''}`}
    >
      {isDark ? <MoonIcon size={16} /> : <SunIcon size={16} />}
    </button>
  );
}
