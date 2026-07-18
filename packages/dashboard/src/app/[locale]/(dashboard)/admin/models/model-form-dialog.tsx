'use client';

import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
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

const PROVIDERS = ['openai', 'anthropic', 'google-ai-studio', 'moonshot', 'workers-ai', 'xiaomi-mimo', 'grok'];

export interface ModelFormData {
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

export const EMPTY_FORM: ModelFormData = {
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

export function ModelFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  onUpdateField,
  advancedOpen,
  onToggleAdvanced,
  formMsg,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: ModelFormData;
  onUpdateField: (field: keyof ModelFormData, value: string) => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  formMsg: string;
  onSubmit: (e: FormEvent) => void;
}) {
  const t = useTranslations('adminModels');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop />
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{editingId ? t('editTitle', { id: editingId }) : t('addTitle')}</DialogTitle>
          <DialogDescription>{t('formDesc')}</DialogDescription>
        </DialogHeader>
        <form id="model-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4 px-6">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('modelId')}</label>
            <Input
              value={form.id}
              onChange={(e) => onUpdateField('id', e.target.value)}
              required
              disabled={!!editingId}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('provider')}</label>
            <select
              value={form.provider}
              onChange={(e) => onUpdateField('provider', e.target.value)}
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
              onChange={(e) => onUpdateField('upstreamModelId', e.target.value)}
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
              onChange={(e) => onUpdateField('inputPrice', e.target.value)}
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
              onChange={(e) => onUpdateField('outputPrice', e.target.value)}
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
              onChange={(e) => onUpdateField('markupRate', e.target.value)}
            />
          </div>

          {/* 高级定价：cache 折扣 + 长上下文档位，留空 = 未启用 */}
          <div className="col-span-2 -mx-6 mt-2 border-t pt-3 px-6">
            <button
              type="button"
              onClick={onToggleAdvanced}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {advancedOpen ? <CaretDown className="h-3 w-3" /> : <CaretRight className="h-3 w-3" />}
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
                  onChange={(e) => onUpdateField('cachedInputPrice', e.target.value)}
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
                  onChange={(e) => onUpdateField('cacheWritePrice', e.target.value)}
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
                  onChange={(e) => onUpdateField('longContextThresholdTokens', e.target.value)}
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
                  onChange={(e) => onUpdateField('longContextInputPrice', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('longContextOutputPrice')}</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.longContextOutputPrice}
                  onChange={(e) => onUpdateField('longContextOutputPrice', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('longContextCachedInputPrice')}</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.longContextCachedInputPrice}
                  onChange={(e) => onUpdateField('longContextCachedInputPrice', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('longContextCacheWritePrice')}</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.longContextCacheWritePrice}
                  onChange={(e) => onUpdateField('longContextCacheWritePrice', e.target.value)}
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
  );
}
