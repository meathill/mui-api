'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RechargeLogItem } from '@/lib/api';

export interface RechargeLogTableProps {
  logs: RechargeLogItem[];
  userMap: Map<string, string>;
  showUserColumn?: boolean;
}

export function RechargeLogTable({ logs, userMap, showUserColumn = true }: RechargeLogTableProps) {
  const t = useTranslations('adminRecharge');
  const colSpan = showUserColumn ? 6 : 5;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colTime')}</TableHead>
            {showUserColumn && <TableHead>{t('colUser')}</TableHead>}
            <TableHead>{t('colOperator')}</TableHead>
            <TableHead className="text-right">{t('colAmount')}</TableHead>
            <TableHead className="text-right">{t('colBalanceAfter')}</TableHead>
            <TableHead>{t('colNote')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-muted-foreground text-xs">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
              </TableCell>
              {showUserColumn && (
                <TableCell className="text-xs" title={log.userId}>
                  {userMap.get(log.userId) || log.userId}
                </TableCell>
              )}
              <TableCell className="text-xs" title={log.operatorId || ''}>
                {log.operatorId ? userMap.get(log.operatorId) || log.operatorId : '-'}
              </TableCell>
              <TableCell className="text-right font-mono">${formatBalance(log.amount)}</TableCell>
              <TableCell className="text-right font-mono">
                {log.balanceAfter != null ? `$${formatBalance(log.balanceAfter)}` : '-'}
              </TableCell>
              <TableCell className="text-muted-foreground">{log.note || '-'}</TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">
                {t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
