'use client';

import { useEffect, useState } from 'react';
import { api, type GlobalConfig, type SpendingStats } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from '@/components/ui/alert-dialog';

export default function SettingsPage() {
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
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.setGlobalConfig({
        dailySpendingCap: Number(dailyCap) || 0,
        monthlySpendingCap: Number(monthlyCap) || 0,
        adminEmail: adminEmail || undefined,
      } as GlobalConfig);
      setMsg('保存成功');
      loadData();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '保存失败');
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
      setErrorMessage(err instanceof Error ? err.message : '操作失败');
      setErrorDialogOpen(true);
    }
  }

  if (loading) return <p className="text-muted-foreground">加载中...</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  const pauseAction = config?.isServicePaused ? '恢复' : '暂停';

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">全局设置</h2>

      {/* 暂停/恢复确认弹窗 */}
      <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{pauseAction}服务</AlertDialogTitle>
            <AlertDialogDescription>
              {config?.isServicePaused ? '恢复后所有 API 请求将正常处理。' : '暂停后所有 API 请求将返回 503 错误。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">取消</Button>} />
            <Button variant={config?.isServicePaused ? 'default' : 'destructive'} onClick={handleConfirmTogglePause}>
              确认{pauseAction}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 错误弹窗 */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>操作失败</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button>确定</Button>} />
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {/* 消费概况 */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">今日消费</p>
            <p className="text-2xl font-bold font-mono">${stats.dailySpending.toFixed(2)}</p>
            {stats.dailySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>上限 ${stats.dailySpendingCap.toFixed(2)}</span>
                  <span>{((stats.dailySpending / stats.dailySpendingCap) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, (stats.dailySpending / stats.dailySpendingCap) * 100)} />
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-1">本月消费</p>
            <p className="text-2xl font-bold font-mono">${stats.monthlySpending.toFixed(2)}</p>
            {stats.monthlySpendingCap > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>上限 ${stats.monthlySpendingCap.toFixed(2)}</span>
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
              <h3 className="font-medium">服务状态</h3>
              <p className="text-sm text-muted-foreground">
                {config.isServicePaused ? '服务已暂停，所有 API 请求将返回 503' : '服务正常运行中'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={config.isServicePaused ? 'destructive' : 'secondary'}>
                {config.isServicePaused ? '已暂停' : '运行中'}
              </Badge>
              <Button
                variant={config.isServicePaused ? 'default' : 'destructive'}
                size="sm"
                onClick={handleTogglePauseClick}
              >
                {config.isServicePaused ? '恢复服务' : '暂停服务'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 配置表单 */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">消费上限配置</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">日消费上限 (USD)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value)}
                placeholder="0 表示不限制"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">月消费上限 (USD)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monthlyCap}
                onChange={(e) => setMonthlyCap(e.target.value)}
                placeholder="0 表示不限制"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">管理员邮箱（接收告警）</label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-80"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">保存</Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
