'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { signOut } from '@/lib/auth-client';

export function TermsConsentDialog() {
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/user/accept-terms', { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ needsReconsent?: boolean }>;
      })
      .then((data) => {
        if (cancelled || !data) return;
        if (data.needsReconsent) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAgree() {
    if (!agreed) {
      setError('请先勾选同意');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/accept-terms', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) throw new Error('failed');
      setOpen(false);
      router.refresh();
    } catch {
      setError('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline() {
    await signOut();
    window.location.href = '/login';
  }

  // 强制模态：open 时不允许通过外部关闭
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogPopup showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>请阅读并同意协议</DialogTitle>
          <DialogDescription>
            继续使用 MuiRouter 前，请阅读并同意我们的使用协议与隐私政策。条款更新后需重新确认。
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-6">
            点击同意即表示你已阅读并同意
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline mx-1"
            >
              使用协议
            </a>
            和
            <a
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline mx-1"
            >
              隐私政策
            </a>
            。
          </p>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <span>我已阅读并同意使用协议与隐私政策</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDecline} disabled={loading}>
            拒绝并退出
          </Button>
          <Button onClick={handleAgree} disabled={loading || !agreed}>
            {loading ? '提交中…' : '同意并继续'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
