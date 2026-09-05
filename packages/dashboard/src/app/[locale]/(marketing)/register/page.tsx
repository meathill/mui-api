'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Link, useRouter } from '@/i18n/navigation';
import { trackSignUp } from '@/lib/analytics';
import { signUp } from '@/lib/auth-client';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@/lib/legal';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('register');
  const te = useTranslations('errors');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!agreed) {
      setError(t('agreeTermsRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setError(te('passwordMismatch'));
      return;
    }

    if (password.length < 8) {
      setError(te('passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const result = await (
        signUp.email as unknown as (p: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>
      )({
        email,
        password,
        name: name || email.split('@')[0],
        acceptedTermsAt: new Date(),
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      });
      if (result.error) {
        setError(result.error.message || te('registerFailed'));
        return;
      }
      trackSignUp('email');
      router.push('/app');
    } catch {
      setError(te('registerFailedRetry'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
      <Card className="w-full max-w-sm p-6">
        <Image
          src="/brand/mui-mark.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-3 rounded-lg border-2 border-[var(--brand-ink)] shadow-[0_3px_0_0_var(--brand-ink)]"
          aria-hidden
          priority
        />
        <h2 className="text-xl font-bold text-center mb-5">{t('title')}</h2>

        <SocialLoginButtons />

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            {t('or')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t('nameLabel')} <span className="text-muted-foreground font-normal">{t('nameOptional')}</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('emailLabel')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('passwordLabel')}</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('confirmPasswordLabel')}</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              required
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
            <span>
              {t('agreeTermsPrefix')}
              <Link href="/terms" target="_blank" className="text-primary underline-offset-4 hover:underline">
                {t('termsLink')}
              </Link>
              {t('agreeTermsAnd')}
              <Link href="/privacy" target="_blank" className="text-primary underline-offset-4 hover:underline">
                {t('privacyLink')}
              </Link>
              {t('agreeTermsSuffix')}
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="press" className="w-full" disabled={loading || !agreed}>
            {loading ? t('submitting') : t('submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('login')}
          </Link>
        </p>
      </Card>
    </div>
  );
}
