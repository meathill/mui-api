'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { api, type UserInfo } from '@/lib/api';
import { type EditFormData, UserEditDialog } from './user-edit-dialog';
import { type SortDirection, type SortField, UserTable } from './user-table';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const t = useTranslations('adminUsers');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 充值
  const [rechargeEmail, setRechargeEmail] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('');
  const [rechargeMsg, setRechargeMsg] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField | null>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 搜索
  const [search, setSearch] = useState('');

  // 分页
  const [page, setPage] = useState(1);

  // 编辑弹窗
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ maxConcurrency: '3', rateMultiplier: '1' });
  const [editMsg, setEditMsg] = useState('');

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 数据处理流水线：搜索 → 排序 → 分页
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const keyword = search.toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(keyword));
  }, [users, search]);

  const sortedUsers = useMemo(() => {
    if (!sortField) return filteredUsers;
    return [...filteredUsers].sort((a, b) => {
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
  }, [filteredUsers, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = sortedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 搜索变化时回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [search]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [te]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
    setRechargeMsg('');
    try {
      const result = await api.recharge(rechargeEmail, Number(rechargeAmount), rechargeNote || undefined);
      setRechargeMsg(te('rechargeSuccess', { balance: formatBalance(result.balance) }));
      setRechargeEmail('');
      setRechargeAmount('');
      setRechargeNote('');
      loadUsers();
    } catch (err) {
      setRechargeMsg(err instanceof Error ? err.message : te('rechargeFailed'));
    }
  }

  function handleEdit(user: UserInfo) {
    setEditingUser(user);
    setEditForm({
      maxConcurrency: String(user.maxConcurrency),
      rateMultiplier: String(user.rateMultiplier),
    });
    setEditMsg('');
    setEditDialogOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditMsg('');

    const maxConcurrency = Number(editForm.maxConcurrency);
    const rateMultiplier = Number(editForm.rateMultiplier);

    try {
      await Promise.all([
        api.setConcurrency(editingUser.userId, maxConcurrency),
        api.setRateMultiplier(editingUser.userId, rateMultiplier),
      ]);
      setEditMsg(te('updateSuccess'));
      loadUsers();
      setTimeout(() => {
        setEditDialogOpen(false);
        setEditMsg('');
      }, 800);
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : te('operationFailed'));
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
        editMsg={editMsg}
        onSubmit={handleEditSubmit}
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
              min="0.01"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              className="w-28"
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
          <Button type="submit">{t('recharge')}</Button>
          {rechargeMsg && <span className="text-sm text-muted-foreground">{rechargeMsg}</span>}
        </form>
      </Card>

      {/* 充值记录链接 */}
      <div className="mb-4">
        <Link href="/admin/recharge" className="text-sm text-primary hover:underline">
          {t('viewRechargeHistory')}
        </Link>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : (
        <>
          <UserTable
            users={pagedUsers}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={handleEdit}
            onUnsuspend={handleUnsuspend}
            hasSearch={!!search}
          />

          {/* 分页 */}
          {sortedUsers.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-muted-foreground">
                {t('pagination', { count: sortedUsers.length, page: safePage, totalPages })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}>
                  {t('prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
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
