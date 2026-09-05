'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trackApiKeyCreated } from '@/lib/analytics';
import { userApi } from '@/lib/api';

interface ApiKey {
  id: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
}

export default function KeysPage() {
  const t = useTranslations('keys');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [newRawKey, setNewRawKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeKeyId, setRevokeKeyId] = useState('');

  const fetchKeys = useCallback(async () => (await userApi.getKeys()).keys, []);
  const { data: keys, loading, error, reload: loadKeys } = useAsyncResource<ApiKey[]>(fetchKeys, []);

  async function handleCreateKey() {
    setCreating(true);
    try {
      const result = await userApi.createKey();
      trackApiKeyCreated();
      setNewRawKey(result.rawKey);
      setCopied(false);
      setNewKeyDialogOpen(true);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : te('createFailed'));
      setErrorDialogOpen(true);
    } finally {
      setCreating(false);
    }
  }

  function handleNewKeyDialogChange(open: boolean) {
    setNewKeyDialogOpen(open);
    if (!open) {
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
      setErrorMessage(e instanceof Error ? e.message : te('revokeFailed'));
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
      <PageHeader
        eyebrow="Dashboard · API Keys"
        title={t('title')}
        actions={
          <Button onClick={handleCreateKey} disabled={creating}>
            {creating ? t('generating') : t('generate')}
          </Button>
        }
      />

      <Dialog open={newKeyDialogOpen} onOpenChange={handleNewKeyDialogChange}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{t('generated')}</DialogTitle>
            <DialogDescription>{t('generatedDesc')}</DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-2">
            <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all select-all">{newRawKey}</div>
          </div>
          <DialogFooter variant="bare">
            <Button variant="outline" onClick={handleCopyKey}>
              {copied ? t('copied') : t('copy')}
            </Button>
            <DialogClose render={<Button>{t('saved')}</Button>} />
          </DialogFooter>
        </DialogPopup>
      </Dialog>

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

      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmRevoke')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmRevokeDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{tc('cancel')}</Button>} />
            <Button variant="destructive" onClick={handleConfirmRevoke}>
              {t('confirmRevoke')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {error && <p className="text-destructive mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('keyPrefix')}</TableHead>
                <TableHead className="text-center">{t('status')}</TableHead>
                <TableHead>{t('createdAt')}</TableHead>
                <TableHead className="text-center">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                  <TableCell className="text-center">
                    {key.isActive ? (
                      <Badge variant="secondary">{t('active')}</Badge>
                    ) : (
                      <Badge variant="destructive">{t('revoked')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {key.isActive && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => handleRevokeClick(key.id)}
                      >
                        {t('revoke')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {t('empty')}
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
