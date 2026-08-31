'use client';

import { ArrowDown, ArrowsDownUp, ArrowUp } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import type { UserInfo } from '@/lib/api';

export type SortField = 'email' | 'balance' | 'rateMultiplier' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

function SortIndicator({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField | null;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowsDownUp className="inline ml-1 h-3 w-3 text-muted-foreground/40" />;
  }
  return sortDirection === 'desc' ? (
    <ArrowDown className="inline ml-1 h-3 w-3" />
  ) : (
    <ArrowUp className="inline ml-1 h-3 w-3" />
  );
}

export function UserTable({
  users,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onUnsuspend,
  hasSearch,
}: {
  users: UserInfo[];
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEdit: (user: UserInfo) => void;
  onUnsuspend: (user: UserInfo) => void;
  hasSearch: boolean;
}) {
  const t = useTranslations('adminUsers');

  const SORTABLE_COLUMNS: { field: SortField; label: string; align?: string; hint?: string }[] = [
    { field: 'email', label: t('colEmail') },
    { field: 'balance', label: t('colBalance'), align: 'text-right', hint: '仅当前页排序' },
    { field: 'rateMultiplier', label: t('colRate'), align: 'text-right', hint: '仅当前页排序' },
    { field: 'createdAt', label: t('colCreatedAt') },
  ];

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={`cursor-pointer select-none hover:bg-muted/50 ${col.align ?? ''}`}
                onClick={() => onSort(col.field)}
                title={col.hint}
              >
                {col.label}
                <SortIndicator field={col.field} sortField={sortField} sortDirection={sortDirection} />
              </TableHead>
            ))}
            <TableHead className="text-right">{t('colConcurrency')}</TableHead>
            <TableHead className="text-center">{t('colStatus')}</TableHead>
            <TableHead className="text-center">{t('colActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.userId}>
              <TableCell>{user.email}</TableCell>
              <TableCell className="text-right font-mono">${user.balance.toFixed(4)}</TableCell>
              <TableCell className="text-right">
                {user.rateMultiplier !== 1 ? (
                  <Badge variant="outline">{user.rateMultiplier}x</Badge>
                ) : (
                  <span className="text-muted-foreground">1x</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
              </TableCell>
              <TableCell className="text-right">
                {user.concurrency}/{user.maxConcurrency}
              </TableCell>
              <TableCell className="text-center">
                {user.isSuspended ? (
                  <Badge variant="destructive">{t('suspended')}</Badge>
                ) : (
                  <Badge variant="secondary">{t('normal')}</Badge>
                )}
              </TableCell>
              <TableCell className="text-center space-x-1">
                <Button
                  variant="ghost"
                  size="xs"
                  render={<Link href={`/admin/users/${user.userId}`}>{t('viewDetail')}</Link>}
                />
                <Button variant="ghost" size="xs" onClick={() => onEdit(user)}>
                  {t('edit')}
                </Button>
                {user.isSuspended && (
                  <Button variant="ghost" size="xs" onClick={() => onUnsuspend(user)}>
                    {t('unsuspend')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {hasSearch ? t('noMatch') : t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
