'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import type { UsageLog } from '@/lib/api';

export interface UsageLogTableProps {
  logs: UsageLog[];
  userMap?: Map<string, string>;
  showUserColumn?: boolean;
}

export function UsageLogTable({ logs, userMap, showUserColumn = true }: UsageLogTableProps) {
  const t = useTranslations('adminUsage');
  const colSpan = showUserColumn ? 6 : 5;

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('colTime')}</TableHead>
            {showUserColumn && <TableHead>{t('colUser')}</TableHead>}
            <TableHead>{t('colModel')}</TableHead>
            <TableHead className="text-right">{t('colInput')}</TableHead>
            <TableHead className="text-right">{t('colOutput')}</TableHead>
            <TableHead className="text-right">{t('colCost')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-muted-foreground text-xs">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
              </TableCell>
              {showUserColumn && (
                <TableCell className="text-xs" title={log.userId || ''}>
                  {log.userId ? (
                    <Link href={`/admin/users/${log.userId}`} className="text-primary hover:underline">
                      {userMap?.get(log.userId) || `${log.userId.slice(0, 8)}...`}
                    </Link>
                  ) : (
                    '-'
                  )}
                </TableCell>
              )}
              <TableCell>{log.modelId || '-'}</TableCell>
              <TableCell className="text-right font-mono">{log.inputTokens?.toLocaleString() ?? '-'}</TableCell>
              <TableCell className="text-right font-mono">{log.outputTokens?.toLocaleString() ?? '-'}</TableCell>
              <TableCell className="text-right font-mono">${log.cost?.toFixed(4) ?? '-'}</TableCell>
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
