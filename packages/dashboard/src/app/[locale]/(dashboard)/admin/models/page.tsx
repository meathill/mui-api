'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
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
import { Input } from '@/components/ui/input';
import { api, type ModelCreateInput, type ModelInfo } from '@/lib/api';
import { EMPTY_FORM, type ModelFormData, ModelFormDialog } from './model-form-dialog';
import { ModelTable, type SortDirection, type SortField } from './model-table';

const PAGE_SIZE = 20;

function parseOptionalNumber(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export default function ModelsPage() {
  const t = useTranslations('adminModels');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

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

  async function handleSubmit(e: FormEvent) {
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
      <ModelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        form={form}
        onUpdateField={updateField}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
        formMsg={formMsg}
        onSubmit={handleSubmit}
      />

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
          <ModelTable
            models={pagedModels}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            hasSearch={!!search}
          />

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
