'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from 'lucide-react';
import { api, type UserInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogClose,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 20;

type SortField = 'email' | 'balance' | 'rateMultiplier' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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
    return <ArrowUpDownIcon className="inline ml-1 h-3 w-3 text-muted-foreground/40" />;
  }
  return sortDirection === 'desc' ? (
    <ArrowDownIcon className="inline ml-1 h-3 w-3" />
  ) : (
    <ArrowUpIcon className="inline ml-1 h-3 w-3" />
  );
}

interface EditFormData {
  maxConcurrency: string;
  rateMultiplier: string;
}

export default function UsersPage() {
  const t = useTranslations('adminUsers');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const SORTABLE_COLUMNS: { field: SortField; label: string; align?: string }[] = [
    { field: 'email', label: t('colEmail') },
    { field: 'balance', label: t('colBalance'), align: 'text-right' },
    { field: 'rateMultiplier', label: t('colRate'), align: 'text-right' },
    { field: 'createdAt', label: t('colCreatedAt') },
  ];

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

  // userId -> email 映射
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.userId, u.email);
    }
    return map;
  }, [users]);

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

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

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
      setRechargeMsg(te('rechargeSuccess', { balance: result.balance.toFixed(2) }));
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

  async function handleToggleSuspend(user: UserInfo) {
    try {
      if (user.isSuspended) {
        await api.unsuspendUser(user.userId);
      } else {
        await api.unsuspendUser(user.userId);
      }
      loadUsers();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : te('operationFailed'));
      setErrorDialogOpen(true);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t('title')}</h2>

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
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{t('editUser')}</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <form id="user-edit-form" onSubmit={handleEditSubmit} className="grid grid-cols-2 gap-4 px-6">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('maxConcurrency')}</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={editForm.maxConcurrency}
                onChange={(e) => setEditForm((prev) => ({ ...prev, maxConcurrency: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('rateMultiplier')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editForm.rateMultiplier}
                onChange={(e) => setEditForm((prev) => ({ ...prev, rateMultiplier: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">{t('rateMultiplierHint')}</p>
            </div>
          </form>
          <DialogFooter variant="bare">
            {editMsg && <span className="text-sm text-muted-foreground mr-auto">{editMsg}</span>}
            <DialogClose render={<Button variant="outline">{t('cancel')}</Button>} />
            <Button type="submit" form="user-edit-form">
              {t('update')}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* 充值 */}
      <Card className="p-4 mb-6">
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
      <div className="mb-6">
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {SORTABLE_COLUMNS.map((col) => (
                    <TableHead
                      key={col.field}
                      className={`cursor-pointer select-none hover:bg-muted/50 ${col.align ?? ''}`}
                      onClick={() => handleSort(col.field)}
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
                {pagedUsers.map((user) => (
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
                      <Button variant="ghost" size="xs" onClick={() => handleEdit(user)}>
                        {t('edit')}
                      </Button>
                      {user.isSuspended && (
                        <Button variant="ghost" size="xs" onClick={() => handleToggleSuspend(user)}>
                          {t('unsuspend')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {pagedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {search ? t('noMatch') : t('empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* 分页 */}
          {sortedUsers.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
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
