'use client';

import { useEffect, useState } from 'react';
import type { HistoryItem } from './playground-types';
import { MAX_HISTORY_ITEMS, parseHistory } from './playground-utils';

const API_KEY_STORAGE_KEY = 'playground_api_key';
const HISTORY_STORAGE_KEY = 'playground_history';
const RECENT_MODELS_KEY = 'playground_recent_models';
const MAX_RECENT_PER_MODE = 5;
const RECENT_MODES = ['chat', 'image', 'video', 'tts'] as const;

export type RecentModels = Record<string, string[]>;

function parseRecent(raw: string | null): RecentModels {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: RecentModels = {};
    for (const k of RECENT_MODES) {
      const v = parsed[k];
      if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT_PER_MODE);
    }
    return out;
  } catch {
    return {};
  }
}

export function usePlaygroundStorage() {
  const [apiKey, setApiKey] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [recentModels, setRecentModels] = useState<RecentModels>({});

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    const savedRecent = localStorage.getItem(RECENT_MODELS_KEY);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(parseHistory(savedHistory));
    if (savedRecent) setRecentModels(parseRecent(savedRecent));
  }, []);

  function changeApiKey(value: string) {
    setApiKey(value);
    if (value) localStorage.setItem(API_KEY_STORAGE_KEY, value);
    else localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  function createHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): string {
    const nextItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setHistory((current) => persistHistory([nextItem, ...current].slice(0, MAX_HISTORY_ITEMS)));
    return nextItem.id;
  }

  function updateHistory(id: string, patch: Partial<HistoryItem>) {
    setHistory((current) => persistHistory(current.map((item) => (item.id === id ? { ...item, ...patch } : item))));
  }

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  function pushRecentModel(mode: string, modelId: string) {
    if (!modelId) return;
    setRecentModels((prev) => {
      const cur = prev[mode] ?? [];
      const next = [modelId, ...cur.filter((id) => id !== modelId)].slice(0, MAX_RECENT_PER_MODE);
      const merged = { ...prev, [mode]: next };
      try {
        localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(merged));
      } catch {}
      return merged;
    });
  }

  return { apiKey, history, recentModels, changeApiKey, createHistory, updateHistory, clearHistory, pushRecentModel };
}

function persistHistory(history: HistoryItem[]): HistoryItem[] {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  return history;
}
