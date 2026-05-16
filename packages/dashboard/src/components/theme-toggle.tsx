'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu';

type Mode = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'mui-theme';

function readStored(): Mode {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function readSystem(): Resolved {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(mode: Mode): Resolved {
  return mode === 'system' ? readSystem() : mode;
}

function applyTheme(resolved: Resolved) {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    setMounted(true);
    const initial = readStored();
    setMode(initial);
    applyTheme(resolve(initial));

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onSystemChange() {
      // 模式是 system 时，跟随系统翻面
      if (readStored() === 'system') {
        applyTheme(readSystem());
      }
    }
    mql.addEventListener('change', onSystemChange);
    return () => mql.removeEventListener('change', onSystemChange);
  }, []);

  function handleSelect(next: Mode) {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(resolve(next));
  }

  const resolved = mounted ? resolve(mode) : 'light';
  const TriggerIcon = mode === 'system' ? MonitorIcon : resolved === 'dark' ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${className ?? ''}`}
        aria-label="Theme"
        title="Theme"
        suppressHydrationWarning
      >
        <TriggerIcon size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => handleSelect(v as Mode)}>
          <DropdownMenuRadioItem value="light">
            <SunIcon />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
