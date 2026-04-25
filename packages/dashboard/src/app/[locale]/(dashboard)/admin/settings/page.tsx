'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api, type GlobalConfig, type SpendingStats } from '@/lib/api';

export default function SettingsPage() {
  const t = useTranslations('adminSettings');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [stats, setStats] = useState<SpendingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [dailyCap, setDailyCap] = useState('');
  const [monthlyCap, setMonthlyCap] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  // 暂停/恢复确认弹窗
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [configRes, statsRes] = await Promise.all([api.getGlobalConfig(), api.getSpendingStats()]);
      setConfig(configRes.config);
      setStats(statsRes.stats);
      setDailyCap(String(configRes.config.dailySpendingCap || ''));
      setMonthlyCap(String(configRes.config.monthlySpendingCap || ''));
      setAdminEmail(configRes.config.adminEmail || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.setGlobalConfig({
        dailySpendingCap: Number(dailyCap) || 0,
        monthlySpendingCap: Number(monthlyCap) || 0,
        adminEmail: adminEmail || undefined,
      } as GlobalConfig);
      setMsg(te('saveSuccess'));
      loadData();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : te('saveFailed'));
    }
  }

  function handleTogglePauseClick() {
    if (!config) return;
    setPauseDialogOpen(true);
  }

  async function handleConfirmTogglePause() {
    if (!config) return;
    setPauseDialogOpen(false);
    try {
      await api.setGlobalConfig({ isServicePaused: !config.isServicePaused } as GlobalConfig);
      loadData();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : te('operationFailed'));
      setErrorDialogOpen(true);
    }
  }

  if (loading) return <p className="text-muted-foreground">{tc('loading')}</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  const pauseAction = config?.isServicePaused ? t('resume') : t('pause');

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t('title')}</h2>

      {/* 暂停/恢复确认弹窗 */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmAction', { action: pauseAction })}</AlertDialogTitle>
            <AlertDialogDescription>
              {config?.isServicePaused ? t('resumeDesc') : t('pauseDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('cancel')}</Button>} />
            <Button variant={config?.isServicePaused ? 'default' : 'destructive'} onClick={handleConfirmTogglePause}>
              {t('confirmBtn', { action: pauseAction })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 错误弹窗 */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{te('operationFailed')}</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button>{te('confirm')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 消费概况 */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{t('todaySpending')}</p>
            <p className="text-2xl font-bold font-mono">${stats.dailySpending.toFixed(2)}</p>
            {stats.dailySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('cap', { amount: stats.dailySpendingCap.toFixed(2) })}</span>
                  <span>{((stats.dailySpending / stats.dailySpendingCap) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, (stats.dailySpending / stats.dailySpendingCap) * 100)} />
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{t('monthlySpending')}</p>
            <p className="text-2xl font-bold font-mono">${stats.monthlySpending.toFixed(2)}</p>
            {stats.monthlySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('cap', { amount: stats.monthlySpendingCap.toFixed(2) })}</span>
                  <span>{((stats.monthlySpending / stats.monthlySpendingCap) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, (stats.monthlySpending / stats.monthlySpendingCap) * 100)} />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 服务状态 */}
      {config && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('serviceStatus')}</h3>
              <p className="text-sm text-muted-foreground">
                {config.isServicePaused ? t('servicePausedDesc') : t('serviceRunningDesc')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={config.isServicePaused ? 'destructive' : 'secondary'}>
                {config.isServicePaused ? t('paused') : t('running')}
              </Badge>
              <Button
                variant={config.isServicePaused ? 'default' : 'destructive'}
                size="sm"
                onClick={handleTogglePauseClick}
              >
                {config.isServicePaused ? t('resumeService') : t('pauseService')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 配置表单 */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">{t('spendingConfig')}</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('dailyCap')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                placeholder={t('noLimit')}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('monthlyCap')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                placeholder={t('noLimit')}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('adminEmail')}</label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-80"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">{t('save')}</Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
