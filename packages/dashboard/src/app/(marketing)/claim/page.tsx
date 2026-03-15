'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CopyIcon, CheckIcon, KeyIcon, AlertTriangleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ClaimState = 'loading' | 'success' | 'error';

function ClaimContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<ClaimState>('loading');
  const [rawKey, setRawKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg('缺少 Token 参数');
      return;
    }

    async function claimKey() {
      try {
        const res = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = (await res.json()) as { success?: boolean; rawKey?: string; error?: string };

        if (!res.ok) {
          setState('error');
          setErrorMsg(data.error || '领取失败');
          return;
        }

        setState('success');
        setRawKey(data.rawKey || '');
      } catch {
        setState('error');
        setErrorMsg('网络错误，请稍后重试');
      }
    }

    claimKey();
  }, [token]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中 code 元素中的文本
      const codeEl = document.querySelector('code');
      if (codeEl) {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      {state === 'loading' && (
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-muted-foreground">正在领取你的 API Key...</p>
        </div>
      )}

      {state === 'success' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <KeyIcon className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-xl font-bold">领取成功！</h1>
            <p className="mt-1 text-sm text-muted-foreground">请立即复制并妥善保管你的 API Key</p>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="mb-2 text-xs text-muted-foreground">你的 API Key</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-sm font-mono">{rawKey}</code>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? <CheckIcon className="h-4 w-4 text-green-600" /> : <CopyIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">重要提示</p>
                <p className="mt-1">此 API Key 仅显示一次，关闭页面后将无法再次查看。请务必立即保存。</p>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link href="/login">
              <Button>前往登录</Button>
            </Link>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">领取失败</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          </div>
          <Link href="/login">
            <Button variant="outline">返回登录</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function ClaimPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-muted-foreground">加载中...</p>
            </div>
          </Card>
        }
      >
        <ClaimContent />
      </Suspense>
    </div>
  );
}
