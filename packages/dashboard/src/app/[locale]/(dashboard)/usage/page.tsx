'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { type Pagination, type UsageLog, type UsageQueryParams, userApi } from '@/lib/api';

const EMPTY_PAGINATION: Pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 };

export default function UserUsagePage() {
  const t = useTranslations('usage');
  const tc = useTranslations('common');

  const [filters, setFilters] = useState<Omit<UsageQueryParams, 'userId'>>({
    page: 1,
    pageSize: 20,
  });
  const [modelId, setModelId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchUsage = useCallback(() => userApi.getUsage(filters), [filters]);
  const {
    data: { logs, pagination },
    loading,
    error,
  } = useAsyncResource(fetchUsage, { logs: [] as UsageLog[], pagination: EMPTY_PAGINATION });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({
      modelId: modelId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 20,
    });
  }

  function handleReset() {
    setModelId('');
    setStartDate('');
    setEndDate('');
    setFilters({ page: 1, pageSize: 20 });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  const totalCost = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);
  const totalInput = logs.reduce((sum, log) => sum + (log.inputTokens ?? 0), 0);
  const totalOutput = logs.reduce((sum, log) => sum + (log.outputTokens ?? 0), 0);

  return (
    <div>
      <PageHeader eyebrow="Dashboard · Usage" title={t('title')} />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('pageCost')}</p>
          <p className="font-heading text-2xl font-bold tracking-tight">${totalCost.toFixed(4)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('inputTokens')}</p>
          <p className="font-heading text-2xl font-bold tracking-tight">{totalInput.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('outputTokens')}</p>
          <p className="font-heading text-2xl font-bold tracking-tight">{totalOutput.toLocaleString()}</p>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('model')}</label>
            <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder={t('optional')} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('startDate')}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('endDate')}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button type="submit">{t('search')}</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('reset')}
          </Button>
        </form>
      </Card>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('time')}</TableHead>
                  <TableHead>{t('model')}</TableHead>
                  <TableHead className="text-right">{t('input')}</TableHead>
                  <TableHead className="text-right">{t('output')}</TableHead>
                  <TableHead className="text-right">{t('cost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>{log.modelId || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{log.inputTokens?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono">{log.outputTokens?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono">${log.cost?.toFixed(4) ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-muted-foreground">
                {t('total', { total: pagination.total, page: pagination.page, totalPages: pagination.totalPages })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  {t('prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
