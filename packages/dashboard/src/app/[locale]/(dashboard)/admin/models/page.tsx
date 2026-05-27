'use client';

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
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
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type ModelCreateInput, type ModelInfo } from '@/lib/api';

const PROVIDERS = ['openai', 'anthropic', 'google-ai-studio', 'workers-ai', 'xiaomi-mimo'];
const PAGE_SIZE = 20;

type SortField = 'id' | 'provider' | 'inputPrice' | 'outputPrice' | 'markupRate';
type SortDirection = 'asc' | 'desc';

interface ModelFormData {
  id: string;
  provider: string;
  upstreamModelId: string;
  inputPrice: string;
  outputPrice: string;
  markupRate: string;
  // 空字符串表示未配置 / 缺省
  cachedInputPrice: string;
  cacheWritePrice: string;
  longContextThresholdTokens: string;
  longContextInputPrice: string;
  longContextCachedInputPrice: string;
  longContextCacheWritePrice: string;
  longContextOutputPrice: string;
}

const EMPTY_FORM: ModelFormData = {
  id: '',
  provider: 'openai',
  upstreamModelId: '',
  inputPrice: '',
  outputPrice: '',
  markupRate: '1.2',
  cachedInputPrice: '',
  cacheWritePrice: '',
  longContextThresholdTokens: '',
  longContextInputPrice: '',
  longContextCachedInputPrice: '',
  longContextCacheWritePrice: '',
  longContextOutputPrice: '',
};

function parseOptionalNumber(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

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

export default function ModelsPage() {
  const t = useTranslations('adminModels');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const SORTABLE_COLUMNS: { field: SortField; label: string; align?: string }[] = [
    { field: 'id', label: t('colModelId') },
    { field: 'provider', label: t('colProvider') },
    { field: 'inputPrice', label: t('colInputPrice'), align: 'text-right' },
    { field: 'outputPrice', label: t('colOutputPrice'), align: 'text-right' },
    { field: 'markupRate', label: t('colMarkupRate'), align: 'text-right' },
  ];

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelFormData>(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField | null>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // 搜索
  const [search, setSearch] = useState('');

  // 分页
  const [page, setPage] = useState(1);

  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteModelId, setDeleteModelId] = useState('');

  // 错误弹窗
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 高级定价折叠区
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 数据处理流水线：搜索 → 排序 → 分页
  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const keyword = search.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(keyword) ||
        m.provider.toLowerCase().includes(keyword) ||
        (m.upstreamModelId?.toLowerCase().includes(keyword) ?? false),
    );
  }, [models, search]);

  const sortedModels = useMemo(() => {
    if (!sortField) return filteredModels;
    return [...filteredModels].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [filteredModels, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedModels.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedModels = sortedModels.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 搜索变化时回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [search]);

  const loadModels = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getModels();
      setModels(data.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [te]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // 取消排序
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  function handleEdit(model: ModelInfo) {
    setEditingId(model.id);
    setForm({
      id: model.id,
      provider: model.provider,
      upstreamModelId: model.upstreamModelId || '',
      inputPrice: String(model.inputPrice ?? ''),
      outputPrice: String(model.outputPrice ?? ''),
      markupRate: String(model.markupRate ?? '1.2'),
      cachedInputPrice: model.cachedInputPrice == null ? '' : String(model.cachedInputPrice),
      cacheWritePrice: model.cacheWritePrice == null ? '' : String(model.cacheWritePrice),
      longContextThresholdTokens:
        model.longContextThresholdTokens == null ? '' : String(model.longContextThresholdTokens),
      longContextInputPrice: model.longContextInputPrice == null ? '' : String(model.longContextInputPrice),
      longContextCachedInputPrice:
        model.longContextCachedInputPrice == null ? '' : String(model.longContextCachedInputPrice),
      longContextCacheWritePrice:
        model.longContextCacheWritePrice == null ? '' : String(model.longContextCacheWritePrice),
      longContextOutputPrice: model.longContextOutputPrice == null ? '' : String(model.longContextOutputPrice),
    });
    setAdvancedOpen(
      model.cachedInputPrice != null || model.cacheWritePrice != null || model.longContextThresholdTokens != null,
    );
    setDialogOpen(true);
    setFormMsg('');
  }

  function handleAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAdvancedOpen(false);
    setDialogOpen(true);
    setFormMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg('');
    const payload: ModelCreateInput = {
      id: form.id,
      provider: form.provider,
      upstreamModelId: form.upstreamModelId || undefined,
      inputPrice: Number(form.inputPrice),
      outputPrice: Number(form.outputPrice),
      markupRate: Number(form.markupRate) || 1.2,
      cachedInputPrice: parseOptionalNumber(form.cachedInputPrice),
      cacheWritePrice: parseOptionalNumber(form.cacheWritePrice),
      longContextThresholdTokens: parseOptionalNumber(form.longContextThresholdTokens),
      longContextInputPrice: parseOptionalNumber(form.longContextInputPrice),
      longContextCachedInputPrice: parseOptionalNumber(form.longContextCachedInputPrice),
      longContextCacheWritePrice: parseOptionalNumber(form.longContextCacheWritePrice),
      longContextOutputPrice: parseOptionalNumber(form.longContextOutputPrice),
    };
    try {
      if (editingId) {
        const { id: _id, ...updateData } = payload;
        await api.updateModel(editingId, updateData);
        setFormMsg(te('updateSuccess'));
      } else {
        await api.createModel(payload);
        setFormMsg(te('createSuccess'));
      }
      loadModels();
      setTimeout(() => {
        setDialogOpen(false);
        setFormMsg('');
      }, 800);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : te('operationFailed'));
    }
  }

  function handleDeleteClick(id: string) {
    setDeleteModelId(id);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    setDeleteDialogOpen(false);
    try {
      await api.deleteModel(deleteModelId);
      loadModels();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : te('deleteFailed'));
      setErrorDialogOpen(true);
    }
  }

  function updateField(field: keyof ModelFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Models"
        title={t('title')}
        actions={<Button onClick={handleAdd}>{t('addModel')}</Button>}
      />

      {/* 搜索栏 */}
      <div className="relative mb-3 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
      </div>

      {/* 编辑/新增弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{editingId ? t('editTitle', { id: editingId }) : t('addTitle')}</DialogTitle>
            <DialogDescription>{t('formDesc')}</DialogDescription>
          </DialogHeader>
          <form id="model-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 px-6">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('modelId')}</label>
              <Input
                value={form.id}
                onChange={(e) => updateField('id', e.target.value)}
                required
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('provider')}</label>
              <select
                value={form.provider}
                onChange={(e) => updateField('provider', e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors"
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">{t('upstreamModelId')}</label>
              <Input
                value={form.upstreamModelId}
                onChange={(e) => updateField('upstreamModelId', e.target.value)}
                placeholder={t('upstreamPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('inputPrice')}</label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.inputPrice}
                onChange={(e) => updateField('inputPrice', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('outputPrice')}</label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.outputPrice}
                onChange={(e) => updateField('outputPrice', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('markupRate')}</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.markupRate}
                onChange={(e) => updateField('markupRate', e.target.value)}
              />
            </div>

            {/* 高级定价：cache 折扣 + 长上下文档位，留空 = 未启用 */}
            <div className="col-span-2 -mx-6 mt-2 border-t pt-3 px-6">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {advancedOpen ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                {t('advancedPricing')}
              </button>
              <p className="text-xs text-muted-foreground mt-1">{t('advancedHint')}</p>
            </div>

            {advancedOpen && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('cachedInputPrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.cachedInputPrice}
                    onChange={(e) => updateField('cachedInputPrice', e.target.value)}
                    placeholder={t('emptyMeansDisabled')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('cacheWritePrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.cacheWritePrice}
                    onChange={(e) => updateField('cacheWritePrice', e.target.value)}
                    placeholder={t('anthropicOnly')}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">{t('longContextThresholdTokens')}</label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={form.longContextThresholdTokens}
                    onChange={(e) => updateField('longContextThresholdTokens', e.target.value)}
                    placeholder={t('thresholdPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('longContextInputPrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.longContextInputPrice}
                    onChange={(e) => updateField('longContextInputPrice', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('longContextOutputPrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.longContextOutputPrice}
                    onChange={(e) => updateField('longContextOutputPrice', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('longContextCachedInputPrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.longContextCachedInputPrice}
                    onChange={(e) => updateField('longContextCachedInputPrice', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('longContextCacheWritePrice')}</label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={form.longContextCacheWritePrice}
                    onChange={(e) => updateField('longContextCacheWritePrice', e.target.value)}
                  />
                </div>
              </>
            )}
          </form>
          <DialogFooter variant="bare">
            {formMsg && <span className="text-sm text-muted-foreground mr-auto">{formMsg}</span>}
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  {t('cancel')}
                </Button>
              }
            />
            <Button type="submit" form="model-form">
              {editingId ? t('update') : t('create')}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDeleteDesc', { id: deleteModelId })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('cancel')}</Button>} />
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('confirmDelete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

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
                  <TableHead>{t('colUpstream')}</TableHead>
                  <TableHead className="text-center">{t('colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-mono text-xs">{model.id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{model.provider}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">${model.inputPrice?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono">${model.outputPrice?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="text-right">{model.markupRate?.toFixed(2) ?? '-'}x</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{model.upstreamModelId || '-'}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="ghost" size="xs" onClick={() => handleEdit(model)}>
                        {t('edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => handleDeleteClick(model.id)}
                      >
                        {t('delete')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedModels.length === 0 && (
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
          {sortedModels.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-muted-foreground">
                {t('pagination', { count: sortedModels.length, page: safePage, totalPages })}
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
