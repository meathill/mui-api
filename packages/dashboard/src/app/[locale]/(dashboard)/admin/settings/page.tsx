'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useAsyncResource } from '@/hooks/use-async-resource';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { api, type GlobalConfig, type ModelInfo, type SpendingStats } from '@/lib/api';

const DEFAULT_FREE_QUOTA = {
  enabled: false,
  amount: 0,
  modelIds: [] as string[],
};

interface SettingsData {
  config: GlobalConfig | null;
  stats: SpendingStats | null;
  models: ModelInfo[];
}

const EMPTY_SETTINGS_DATA: SettingsData = { config: null, stats: null, models: [] };

export default function SettingsPage() {
  const t = useTranslations('adminSettings');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [msg, setMsg] = useState('');

  const [dailyCap, setDailyCap] = useState('');
  const [monthlyCap, setMonthlyCap] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [freeQuotaEnabled, setFreeQuotaEnabled] = useState(false);
  const [freeQuotaAmount, setFreeQuotaAmount] = useState('');
  const [freeQuotaModelIds, setFreeQuotaModelIds] = useState<string[]>([]);

  // 暂停/恢复确认弹窗
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSettingsData = useCallback(async (): Promise<SettingsData> => {
    const [configRes, statsRes, modelsRes] = await Promise.all([
      api.getGlobalConfig(),
      api.getSpendingStats(),
      api.getModels(),
    ]);
    return { config: configRes.config, stats: statsRes.stats, models: modelsRes.models };
  }, []);
  const {
    data: { config, stats, models },
    loading,
    error,
    reload: loadData,
  } = useAsyncResource(fetchSettingsData, EMPTY_SETTINGS_DATA);

  useEffect(() => {
    if (!config) return;
    const freeQuota = config.freeQuota ?? DEFAULT_FREE_QUOTA;
    setDailyCap(String(config.dailySpendingCap || ''));
    setMonthlyCap(String(config.monthlySpendingCap || ''));
    setAdminEmail(config.adminEmail || '');
    setFreeQuotaEnabled(freeQuota.enabled);
    setFreeQuotaAmount(String(freeQuota.amount || ''));
    setFreeQuotaModelIds(freeQuota.modelIds);
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.setGlobalConfig({
        dailySpendingCap: Number(dailyCap) || 0,
        monthlySpendingCap: Number(monthlyCap) || 0,
        adminEmail: adminEmail || undefined,
        freeQuota: {
          enabled: freeQuotaEnabled,
          amount: Number(freeQuotaAmount) || 0,
          modelIds: freeQuotaModelIds,
        },
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

  function toggleFreeQuotaModel(modelId: string, checked: boolean | 'indeterminate') {
    setFreeQuotaModelIds((prev) => {
      if (checked === true) {
        return prev.includes(modelId) ? prev : [...prev, modelId];
      }
      return prev.filter((id) => id !== modelId);
    });
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
      <PageHeader eyebrow="Admin · Settings" title={t('title')} />

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
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{t('todaySpending')}</p>
            <p className="font-heading text-2xl font-bold tracking-tight">${formatBalance(stats.dailySpending)}</p>
            {stats.dailySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('cap', { amount: formatBalance(stats.dailySpendingCap) })}</span>
                  <span>{((stats.dailySpending / stats.dailySpendingCap) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, (stats.dailySpending / stats.dailySpendingCap) * 100)} />
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{t('monthlySpending')}</p>
            <p className="font-heading text-2xl font-bold tracking-tight">${formatBalance(stats.monthlySpending)}</p>
            {stats.monthlySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('cap', { amount: formatBalance(stats.monthlySpendingCap) })}</span>
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
        <Card className="p-4 mb-4">
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

      {/* 免费额度配置 */}
      <Card className="p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">{t('freeQuotaConfig')}</h3>
            <p className="text-sm text-muted-foreground">{t('freeQuotaConfigDesc')}</p>
          </div>
          <Switch
            checked={freeQuotaEnabled}
            onCheckedChange={(checked) => setFreeQuotaEnabled(checked === true)}
            aria-label={t('freeQuotaEnabled')}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('freeQuotaAmount')}</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={freeQuotaAmount}
              onChange={(e) => setFreeQuotaAmount(e.target.value)}
              placeholder="0.00"
              disabled={!freeQuotaEnabled}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t('freeQuotaAmountHint')}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-xs text-muted-foreground">{t('freeQuotaModels')}</label>
              <Badge variant={freeQuotaModelIds.length > 0 ? 'secondary' : 'outline'}>
                {t('freeQuotaModelCount', { count: freeQuotaModelIds.length })}
              </Badge>
            </div>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-border p-3 md:grid-cols-2">
              {models.map((model) => (
                <label
                  key={model.id}
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={freeQuotaModelIds.includes(model.id)}
                    onCheckedChange={(checked) => toggleFreeQuotaModel(model.id, checked)}
                    disabled={!freeQuotaEnabled}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{model.id}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{model.provider}</span>
                </label>
              ))}
              {models.length === 0 && <p className="text-sm text-muted-foreground">{t('freeQuotaNoModels')}</p>}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('freeQuotaModelsHint')}</p>
          </div>
        </div>
      </Card>

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
