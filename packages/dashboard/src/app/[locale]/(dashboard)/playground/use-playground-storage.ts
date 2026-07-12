'use client';

import { useEffect, useState } from 'react';
import type { HistoryItem } from './playground-types';
import { MAX_HISTORY_ITEMS, parseHistory } from './playground-utils';

const API_KEY_STORAGE_KEY = 'playground_api_key';
const HISTORY_STORAGE_KEY = 'playground_history';

export function usePlaygroundStorage() {
  const [apiKey, setApiKey] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(parseHistory(savedHistory));
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

  return { apiKey, history, changeApiKey, createHistory, updateHistory, clearHistory };
}

function persistHistory(history: HistoryItem[]): HistoryItem[] {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  return history;
}
