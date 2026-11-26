'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { OTPField, OTPFieldInput } from '@/components/ui/otp-field';
import { getAuthEmailDefaultName, hasAuthEmailAlias, normalizeAuthEmail } from '@/lib/auth-email';
import { authClient } from '@/lib/auth-client';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_SLOT_KEYS = Array.from({ length: OTP_LENGTH }, (_, index) => `otp-slot-${index}`);

interface EmailOtpFormProps {
  mode: 'login' | 'register';
}

export function EmailOtpForm({ mode }: EmailOtpFormProps) {
  const router = useRouter();
  const t = useTranslations('authOtp');
  const registerT = useTranslations('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const submittingRef = useRef(false);

  const normalizedEmail = normalizeAuthEmail(email);
  const hasAlias = hasAuthEmailAlias(email);
  const showAliasHint = hasAlias && normalizedEmail !== email.trim().toLowerCase();

  useEffect(() => {
    if (step !== 'code') return;
    try {
      const lastSentAt = Number(window.localStorage.getItem(`muirouter:otp-resend:${normalizedEmail}`));
      const remaining = Math.ceil((lastSentAt + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
      setResendAfter(Number.isFinite(remaining) ? Math.max(0, remaining) : 0);
    } catch {
      setResendAfter(0);
    }
  }, [step, normalizedEmail]);

  useEffect(() => {
    if (resendAfter <= 0) return;
    const timer = window.setInterval(() => {
      setResendAfter((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  function getOtpErrorMessage(code?: string, status?: number): string {
    if (code === 'TOO_MANY_ATTEMPTS') return t('tooManyAttempts');
    if (code === 'INVALID_OTP' || code === 'OTP_EXPIRED') return t('invalidCode');
    if (status === 429) return t('sendFailed');
    return mode === 'login' ? t('loginFailed') : t('registerFailed');
  }

  function startResendCountdown() {
    const now = Date.now();
    try {
      window.localStorage.setItem(`muirouter:otp-resend:${normalizedEmail}`, String(now));
    } catch {
      // 隐私模式下 localStorage 可能不可用，服务端限流仍然生效。
    }
    setResendAfter(RESEND_COOLDOWN_SECONDS);
  }

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'sign-in',
      });
      if (result.error) {
        setError(getOtpErrorMessage(result.error.code, result.error.status));
        return;
      }
      setOtp('');
      setStep('code');
      startResendCountdown();
    } catch {
      setError(t('sendFailed'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function verifyCode(code: string) {
    if (submittingRef.current || code.length !== OTP_LENGTH) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: code,
        name: name.trim() || getAuthEmailDefaultName(email),
      });
      if (result.error) {
        setError(getOtpErrorMessage(result.error.code, result.error.status));
        setOtp('');
        return;
      }
      router.push('/app');
      router.refresh();
    } catch {
      setError(mode === 'login' ? t('loginFailed') : t('registerFailed'));
      setOtp('');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    await verifyCode(otp);
  }

  async function handleResend() {
    if (resendAfter > 0 || submittingRef.current) return;
    submittingRef.current = true;
    setError('');
    setLoading(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'sign-in',
      });
      if (result.error) {
        setError(getOtpErrorMessage(result.error.code, result.error.status));
        return;
      }
      setOtp('');
      startResendCountdown();
    } catch {
      setError(t('sendFailed'));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  function handleChangeEmail() {
    setStep('email');
    setOtp('');
    setError('');
  }

  if (step === 'code') {
    return (
      <form onSubmit={handleVerify} className="space-y-4">
        <Field>
          <FieldLabel>{t('codeLabel')}</FieldLabel>
          <OTPField
            aria-label={t('codeLabel')}
            length={OTP_LENGTH}
            value={otp}
            onValueChange={setOtp}
            onValueComplete={verifyCode}
            disabled={loading}
            required
          >
            {OTP_SLOT_KEYS.map((slotKey, index) => (
              <OTPFieldInput
                key={slotKey}
                aria-label={index === 0 ? undefined : t('slotLabel', { current: index + 1, total: OTP_LENGTH })}
              />
            ))}
          </OTPField>
          <FieldDescription>{t('codeDescription', { email: normalizedEmail })}</FieldDescription>
          {error && <FieldError match>{error}</FieldError>}
        </Field>

        <Button type="submit" variant="press" className="w-full" disabled={loading || otp.length !== OTP_LENGTH}>
          {loading ? t('verifying') : mode === 'login' ? t('verifyLogin') : t('verifyRegister')}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-primary hover:underline" onClick={handleChangeEmail} disabled={loading}>
            {t('changeEmail')}
          </button>
          <button
            type="button"
            className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            onClick={handleResend}
            disabled={loading || resendAfter > 0}
          >
            {resendAfter > 0 ? t('resendIn', { seconds: resendAfter }) : t('resend')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      {mode === 'register' && (
        <Field>
          <FieldLabel>
            {registerT('nameLabel')}{' '}
            <span className="text-muted-foreground font-normal">{registerT('nameOptional')}</span>
          </FieldLabel>
          <Input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={registerT('namePlaceholder')}
            autoComplete="name"
          />
        </Field>
      )}
      <Field>
        <FieldLabel>{t('emailLabel')}</FieldLabel>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('emailPlaceholder')}
          required
          autoComplete="email"
          inputMode="email"
        />
        {showAliasHint && <FieldDescription>{t('aliasNormalized', { email: normalizedEmail })}</FieldDescription>}
        {error && <FieldError match>{error}</FieldError>}
      </Field>

      <Button type="submit" variant="press" className="w-full" disabled={loading || !email.trim()}>
        {loading ? t('sendingCode') : t('sendCode')}
      </Button>
    </form>
  );
}
