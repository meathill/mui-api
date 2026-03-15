'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon, SearchIcon } from 'lucide-react';
import { api, type ModelInfo, type ModelCreateInput } from '@/lib/api';
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

const PROVIDERS = ['openai', 'anthropic', 'google-ai-studio'];
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
}

const EMPTY_FORM: ModelFormData = {
  id: '',
  provider: 'openai',
  upstreamModelId: '',
  inputPrice: '',
  outputPrice: '',
  markupRate: '1.2',
};

// 可排序列配置
const SORTABLE_COLUMNS: { field: SortField; label: string; align?: string }[] = [
  { field: 'id', label: '模型 ID' },
  { field: 'provider', label: 'Provider' },
  { field: 'inputPrice', label: '输入价格', align: 'text-right' },
  { field: 'outputPrice', label: '输出价格', align: 'text-right' },
  { field: 'markupRate', label: '倍率', align: 'text-right' },
];

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

  async function loadModels() {
    try {
      setLoading(true);
      const data = await api.getModels();
      setModels(data.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModels();
  }, []);

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
    });
    setDialogOpen(true);
    setFormMsg('');
  }

  function handleAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
    };
    try {
      if (editingId) {
        const { id: _id, ...updateData } = payload;
        await api.updateModel(editingId, updateData);
        setFormMsg('更新成功');
      } else {
        await api.createModel(payload);
        setFormMsg('创建成功');
      }
      loadModels();
      setTimeout(() => {
        setDialogOpen(false);
        setFormMsg('');
      }, 800);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : '操作失败');
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
      setErrorMessage(err instanceof Error ? err.message : '删除失败');
      setErrorDialogOpen(true);
    }
  }

  function updateField(field: keyof ModelFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">模型管理</h2>
        <Button onClick={handleAdd}>添加模型</Button>
      </div>

      {/* 搜索栏 */}
      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模型 ID、Provider、上游模型..."
          className="pl-9"
        />
      </div>

      {/* 编辑/新增弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{editingId ? `编辑: ${editingId}` : '添加模型'}</DialogTitle>
            <DialogDescription>配置模型的 Provider、上游模型 ID 和定价信息</DialogDescription>
          </DialogHeader>
          <form id="model-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 px-6">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">模型 ID</label>
              <Input
                value={form.id}
                onChange={(e) => updateField('id', e.target.value)}
                required
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Provider</label>
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
              <label className="block text-xs text-muted-foreground mb-1">上游模型 ID</label>
              <Input
                value={form.upstreamModelId}
                onChange={(e) => updateField('upstreamModelId', e.target.value)}
                placeholder="留空则与模型 ID 相同"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">输入价格 ($/1M tokens)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.inputPrice}
                onChange={(e) => updateField('inputPrice', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">输出价格 ($/1M tokens)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.outputPrice}
                onChange={(e) => updateField('outputPrice', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">加价倍率</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.markupRate}
                onChange={(e) => updateField('markupRate', e.target.value)}
              />
            </div>
          </form>
          <DialogFooter variant="bare">
            {formMsg && <span className="text-sm text-muted-foreground mr-auto">{formMsg}</span>}
            <DialogClose
              render={
                <Button type="button" variant="outline">
                  取消
                </Button>
              }
            />
            <Button type="submit" form="model-form">
              {editingId ? '更新' : '创建'}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定删除模型 {deleteModelId}？此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">取消</Button>} />
            <Button variant="destructive" onClick={handleConfirmDelete}>
              确认删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

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

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
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
                  <TableHead>上游模型</TableHead>
                  <TableHead className="text-center">操作</TableHead>
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
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-destructive"
                        onClick={() => handleDeleteClick(model.id)}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pagedModels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {search ? '无匹配结果' : '暂无模型'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* 分页 */}
          {sortedModels.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                共 {sortedModels.length} 条，第 {safePage}/{totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}>
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
