'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/admin/admin-skeletons';
import { PageHeader } from '@/components/page-header';
import { Spinner } from '@/components/ui/spinner';
import { toastManager } from '@/components/ui/toast';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { Link } from '@/i18n/navigation';
import { api, type Pagination, type UserInfo } from '@/lib/api';
import { type EditFormData, UserEditDialog } from './user-edit-dialog';
import { type SortDirection, type SortField, UserTable } from './user-table';

const PAGE_SIZE = 20;
const EMPTY_PAGINATION: Pagination = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };

type UsersResponse = { users: UserInfo[]; pagination?: Pagination; cursor?: string | null };

export default function UsersPage() {
  const t = useTranslations('adminUsers');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  // 充值
  const [rechargeEmail, setRechargeEmail] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [recharging, setRecharging] = useState(false);

  // 搜索（输入值与防抖后实际请求值分离）
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 分页（服务端）
  const [page, setPage] = useState(1);

  // 排序（当前页内客户端排序，仅作展示；服务端按 createdAt 倒序）
  const [sortField, setSortField] = useState<SortField | null>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 编辑弹窗
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ maxConcurrency: '3', rateMultiplier: '1' });
  const [saving, setSaving] = useState(false);

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 防抖：输入 300ms 后才触发服务端搜索
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 搜索变化回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchUsers = useCallback(async (): Promise<UsersResponse> => {
    const res = await api.getUsers({ page, pageSize: PAGE_SIZE, q: debouncedSearch || undefined });
    return res as UsersResponse;
  }, [page, debouncedSearch]);

  const {
    data: response,
    loading,
    error,
    reload: loadUsers,
  } = useAsyncResource<UsersResponse>(fetchUsers, { users: [], pagination: EMPTY_PAGINATION });

  const users = response.users ?? [];
  const pagination = response.pagination ?? EMPTY_PAGINATION;

  // 当前页内排序（服务端已按 createdAt 倒序，此处仅对当前页做二次排，避免跨页错乱，不建议对 balance 大范围排序）
  const sortedUsers = useMemo(() => {
    if (!sortField) return users;
    return [...users].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'email':
          cmp = a.email.localeCompare(b.email);
          break;
        case 'balance':
          cmp = a.balance - b.balance;
          break;
        case 'rateMultiplier':
          cmp = a.rateMultiplier - b.rateMultiplier;
          break;
        case 'createdAt':
          cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
          break;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [users, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  async function handleRecharge(e: React.FormEvent) {
    e.preventDefault();
    setRecharging(true);
    try {
      const result = await api.recharge(rechargeEmail, Number(rechargeAmount), rechargeNote || undefined);
      toastManager.add({ title: te('rechargeSuccess', { balance: formatBalance(result.balance) }), type: 'success' });
      setRechargeEmail('');
      setRechargeAmount('');
      setRechargeNote('');
      loadUsers();
    } catch (err) {
      toastManager.add({ title: err instanceof Error ? err.message : te('rechargeFailed'), type: 'error' });
    } finally {
      setRecharging(false);
    }
  }

  function handleEdit(user: UserInfo) {
    setEditingUser(user);
    setEditForm({
      maxConcurrency: String(user.maxConcurrency),
      rateMultiplier: String(user.rateMultiplier),
    });
    setEditDialogOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const maxConcurrency = Number(editForm.maxConcurrency);
    const rateMultiplier = Number(editForm.rateMultiplier);
    setSaving(true);
    try {
      await Promise.all([
        api.setConcurrency(editingUser.userId, maxConcurrency),
        api.setRateMultiplier(editingUser.userId, rateMultiplier),
      ]);
      toastManager.add({ title: te('updateSuccess'), type: 'success' });
      loadUsers();
      setEditDialogOpen(false);
    } catch (err) {
      toastManager.add({ title: err instanceof Error ? err.message : te('operationFailed'), type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnsuspend(user: UserInfo) {
    try {
      await api.unsuspendUser(user.userId);
      loadUsers();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : te('operationFailed'));
      setErrorDialogOpen(true);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin · Users" title={t('title')} />

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

      {/* 编辑弹窗 */}
      <UserEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editingUser={editingUser}
        editForm={editForm}
        onChangeField={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleEditSubmit}
        pending={saving}
      />

      {/* 充值 */}
      <Card className="p-4 mb-4">
        <h3 className="font-medium mb-3">{t('recharge')}</h3>
        <form onSubmit={handleRecharge} className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('email')}</label>
            <Input type="email" value={rechargeEmail} onChange={(e) => setRechargeEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('amount')}</label>
            <Input
              type="number"
              step="0.01"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              className="w-28"
              placeholder="正数为充值，负数为扣减"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('note')}</label>
            <Input
              type="text"
              value={rechargeNote}
              onChange={(e) => setRechargeNote(e.target.value)}
              placeholder={t('optional')}
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={recharging}>
            {recharging && <Spinner className="mr-2 size-4" />}
            {t('recharge')}
          </Button>
        </form>
      </Card>

      {/* 充值记录链接 */}
      <div className="mb-4">
        <Link href="/admin/recharge" className="text-sm text-primary hover:underline">
          {t('viewRechargeHistory')}
        </Link>
      </div>

      {/* 搜索栏：服务端 email 搜索 */}
      <div className="relative mb-4 max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <>
          <UserTable
            users={sortedUsers}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={handleEdit}
            onUnsuspend={handleUnsuspend}
            hasSearch={!!debouncedSearch}
          />

          {/* 分页：服务端驱动 */}
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">
              {t('pagination', { count: pagination.total, page: pagination.page, totalPages: pagination.totalPages })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={pagination.page <= 1}>
                {t('prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
