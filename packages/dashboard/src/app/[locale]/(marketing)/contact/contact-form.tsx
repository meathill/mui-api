'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const FEEDBACK_ENDPOINT = process.env.NEXT_PUBLIC_FEEDBACK_URL || 'https://feedback.meathill.com/api/feedback';

export function ContactForm({ locale }: { locale: string }) {
  const isZh = locale === 'zh';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !email.trim()) {
      setError(isZh ? '请填写邮箱和内容' : 'Email and message are required');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'muirouter-contact', name, email, message, locale }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('success');
      setName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div>
        <label className="block text-sm font-medium mb-1">
          {isZh ? '称呼' : 'Name'}{' '}
          <span className="text-muted-foreground font-normal">({isZh ? '可选' : 'optional'})</span>
        </label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isZh ? '你的名字' : 'Your name'} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{isZh ? '邮箱' : 'Email'} *</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{isZh ? '留言' : 'Message'} *</label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isZh ? '请描述你的问题或建议…' : 'Describe your question or feedback…'}
          rows={5}
          required
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status === 'success' && (
        <p className="text-sm text-green-600">{isZh ? '已提交，感谢反馈！' : 'Submitted — thank you!'}</p>
      )}
      {status === 'error' && !error && (
        <p className="text-sm text-destructive">
          {isZh ? '提交失败，请稍后重试或直接发邮件。' : 'Failed. Please try again or email us directly.'}
        </p>
      )}
      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? (isZh ? '提交中…' : 'Submitting…') : isZh ? '提交' : 'Submit'}
      </Button>
    </form>
  );
}
