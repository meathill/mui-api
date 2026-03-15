'use client';

import { useEffect, useRef, useState } from 'react';
import { userApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
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

interface ApiKey {
  id: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [newRawKey, setNewRawKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 吊销确认弹窗
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState('');

  async function loadKeys() {
    try {
      setLoading(true);
      const data = await userApi.getKeys();
      setKeys(data.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreateKey() {
    setCreating(true);
    try {
      const result = await userApi.createKey();
      setNewRawKey(result.rawKey);
      setCopied(false);
      setNewKeyDialogOpen(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '创建失败');
      setErrorDialogOpen(true);
    } finally {
      setCreating(false);
    }
  }

  function handleNewKeyDialogChange(open: boolean) {
    setNewKeyDialogOpen(open);
    if (!open) {
      // 弹窗关闭时刷新列表
      loadKeys();
    }
  }

  function handleRevokeClick(keyId: string) {
    setRevokeKeyId(keyId);
    setRevokeDialogOpen(true);
  }

  async function handleConfirmRevoke() {
    setRevokeDialogOpen(false);
    try {
      await userApi.revokeKey(revokeKeyId);
      loadKeys();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : '吊销失败');
      setErrorDialogOpen(true);
    }
  }

  async function handleCopyKey() {
    try {
      await navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本让用户手动复制
      const el = document.querySelector('.select-all');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">API Key 管理</h2>
        <Button onClick={handleCreateKey} disabled={creating}>
          {creating ? '生成中...' : '生成新 Key'}
        </Button>
      </div>

      {/* 新 Key 弹窗 */}
      <Dialog open={newKeyDialogOpen} onOpenChange={handleNewKeyDialogChange}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>API Key 已生成</DialogTitle>
            <DialogDescription>请立即复制并妥善保管，此 Key 仅显示一次，关闭后无法再查看。</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all select-all">{newRawKey}</div>
          </div>
          <DialogFooter variant="bare">
            <Button variant="outline" onClick={handleCopyKey}>
              {copied ? '已复制 ✓' : '复制'}
            </Button>
            <DialogClose render={<Button>我已保存</Button>} />
          </DialogFooter>
        </DialogPopup>
      </Dialog>

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

      {/* 吊销确认弹窗 */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>确认吊销</AlertDialogTitle>
            <AlertDialogDescription>确定吊销此 API Key？吊销后无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">取消</Button>} />
            <Button variant="destructive" onClick={handleConfirmRevoke}>
              确认吊销
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key 前缀</TableHead>
                <TableHead className="text-center">状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                  <TableCell className="text-center">
                    {key.isActive ? (
                      <Badge variant="secondary">活跃</Badge>
                    ) : (
                      <Badge variant="destructive">已吊销</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {key.createdAt ? new Date(key.createdAt).toLocaleDateString('zh-CN') : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => handleRevokeClick(key.id)}
                      >
                        吊销
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    暂无 API Key，点击上方按钮生成
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
