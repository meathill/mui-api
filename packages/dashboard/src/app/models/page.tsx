"use client";

import { useEffect, useState } from "react";
import { api, type ModelInfo, type ModelCreateInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PROVIDERS = ["openai", "anthropic", "google-ai-studio"];

interface ModelFormData {
  id: string;
  provider: string;
  upstreamModelId: string;
  inputPrice: string;
  outputPrice: string;
  markupRate: string;
}

const EMPTY_FORM: ModelFormData = {
  id: "",
  provider: "openai",
  upstreamModelId: "",
  inputPrice: "",
  outputPrice: "",
  markupRate: "1.2",
};

export default function ModelsPage() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelFormData>(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState("");

  async function loadModels() {
    try {
      setLoading(true);
      const data = await api.getModels();
      setModels(data.models);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadModels();
  }, []);

  function handleEdit(model: ModelInfo) {
    setEditingId(model.id);
    setForm({
      id: model.id,
      provider: model.provider,
      upstreamModelId: model.upstreamModelId || "",
      inputPrice: String(model.inputPrice ?? ""),
      outputPrice: String(model.outputPrice ?? ""),
      markupRate: String(model.markupRate ?? "1.2"),
    });
    setDialogOpen(true);
    setFormMsg("");
  }

  function handleAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    setFormMsg("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg("");
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
        setFormMsg("更新成功");
      } else {
        await api.createModel(payload);
        setFormMsg("创建成功");
      }
      loadModels();
      setTimeout(() => {
        setDialogOpen(false);
        setFormMsg("");
      }, 800);
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`确定删除模型 ${id}？`)) return;
    try {
      await api.deleteModel(id);
      loadModels();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogBackdrop />
        <DialogPopup>
          <DialogTitle>
            {editingId ? `编辑: ${editingId}` : "添加模型"}
          </DialogTitle>
          <DialogDescription>
            配置模型的 Provider、上游模型 ID 和定价信息
          </DialogDescription>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                模型 ID
              </label>
              <Input
                value={form.id}
                onChange={(e) => updateField("id", e.target.value)}
                required
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Provider
              </label>
              <select
                value={form.provider}
                onChange={(e) => updateField("provider", e.target.value)}
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
              <label className="block text-xs text-muted-foreground mb-1">
                上游模型 ID
              </label>
              <Input
                value={form.upstreamModelId}
                onChange={(e) => updateField("upstreamModelId", e.target.value)}
                placeholder="留空则与模型 ID 相同"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                输入价格 ($/1M tokens)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.inputPrice}
                onChange={(e) => updateField("inputPrice", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                输出价格 ($/1M tokens)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.outputPrice}
                onChange={(e) => updateField("outputPrice", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                加价倍率
              </label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={form.markupRate}
                onChange={(e) => updateField("markupRate", e.target.value)}
              />
            </div>
            <div className="col-span-2 flex gap-3 items-center justify-end">
              {formMsg && (
                <span className="text-sm text-muted-foreground">{formMsg}</span>
              )}
              <DialogClose>
                <Button type="button" variant="outline">
                  取消
                </Button>
              </DialogClose>
              <Button type="submit">{editingId ? "更新" : "创建"}</Button>
            </div>
          </form>
        </DialogPopup>
      </Dialog>

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型 ID</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>上游模型</TableHead>
                <TableHead className="text-right">输入价格</TableHead>
                <TableHead className="text-right">输出价格</TableHead>
                <TableHead className="text-right">倍率</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-mono text-xs">{model.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{model.provider}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {model.upstreamModelId || "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${model.inputPrice?.toFixed(2) ?? "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${model.outputPrice?.toFixed(2) ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {model.markupRate?.toFixed(1) ?? "-"}x
                  </TableCell>
                  <TableCell className="text-center space-x-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleEdit(model)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive"
                      onClick={() => handleDelete(model.id)}
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {models.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无模型
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
