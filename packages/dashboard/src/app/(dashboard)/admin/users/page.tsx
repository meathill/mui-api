'use client';

import { useEffect, useState } from 'react';
import { api, type UserInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rechargeEmail, setRechargeEmail] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeMsg, setRechargeMsg] = useState('');

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleRecharge(e: React.FormEvent) {
    e.preventDefault();
    setRechargeMsg('');
    try {
      const result = await api.recharge(rechargeEmail, Number(rechargeAmount));
      setRechargeMsg(`充值成功，余额: $${result.balance.toFixed(2)}`);
      setRechargeEmail('');
      setRechargeAmount('');
      loadUsers();
    } catch (err) {
      setRechargeMsg(err instanceof Error ? err.message : '充值失败');
    }
  }

  async function handleUnsuspend(userId: string) {
    try {
      await api.unsuspendUser(userId);
      loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">用户管理</h2>

      <Card className="p-4 mb-6">
        <h3 className="font-medium mb-3">充值</h3>
        <form onSubmit={handleRecharge} className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">邮箱</label>
            <Input type="email" value={rechargeEmail} onChange={(e) => setRechargeEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">金额 (USD)</label>
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
          <Button type="submit">充值</Button>
          {rechargeMsg && <span className="text-sm text-muted-foreground">{rechargeMsg}</span>}
        </form>
      </Card>

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead className="text-right">余额</TableHead>
                <TableHead className="text-right">并发</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right font-mono">${user.balance.toFixed(4)}</TableCell>
                  <TableCell className="text-right">
                    {user.concurrency}/{user.maxConcurrency}
                  </TableCell>
                  <TableCell className="text-center">
                    {user.isSuspended ? (
                      <Badge variant="destructive">已暂停</Badge>
                    ) : (
                      <Badge variant="secondary">正常</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {user.isSuspended && (
                      <Button variant="ghost" size="xs" onClick={() => user.userId && handleUnsuspend(user.userId)}>
                        解除暂停
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无用户
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
