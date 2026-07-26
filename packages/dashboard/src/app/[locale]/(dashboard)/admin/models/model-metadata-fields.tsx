'use client';

/**
 * 模型对外元数据编辑区。
 *
 * 这些字段喂两个出口：GET /v1/models（Cherry Studio / LobeChat / Cline 靠它自动
 * 发现模型）与 models.dev 的 TOML 生成器（opencode 的模型列表来源）。
 *
 * 主要录入路径是 scripts/fetch-model-metadata.ts 自动回填，手填是低频兜底——
 * 所以能力标记走一个 JSON 文本域而不是 12 个开关，否则 model-form-dialog 会被
 * 撑过 400 行上限。JSON 用与后端共用的校验器实时校验，格式错了当场提示。
 */

import { parseModelMetadata } from '@muirouter/shared-db/model-metadata';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ModelFormData } from './model-form-types';

/** 返回 null 表示合法（含留空）。 */
export function validateMetadataJson(raw: string): string | null {
  const result = parseModelMetadata(raw);
  return result.ok ? null : result.error;
}

export function ModelMetadataFields({
  form,
  onUpdateField,
  open,
  onToggle,
}: {
  form: ModelFormData;
  onUpdateField: (field: keyof ModelFormData, value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('adminModels');
  const metadataError = validateMetadataJson(form.metadataJson);

  return (
    <>
      <div className="col-span-2 -mx-6 mt-2 border-t pt-3 px-6">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? <CaretDown className="h-3 w-3" /> : <CaretRight className="h-3 w-3" />}
          {t('metadataSection')}
        </button>
        <p className="text-xs text-muted-foreground mt-1">{t('metadataHint')}</p>
      </div>

      {open && (
        <>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">{t('displayName')}</label>
            <Input
              value={form.displayName}
              onChange={(e) => onUpdateField('displayName', e.target.value)}
              placeholder={t('displayNamePlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('contextLength')}</label>
            <Input
              type="number"
              step="1"
              min="1"
              value={form.contextLength}
              onChange={(e) => onUpdateField('contextLength', e.target.value)}
              placeholder={t('emptyMeansDisabled')}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('maxOutputTokens')}</label>
            <Input
              type="number"
              step="1"
              min="1"
              value={form.maxOutputTokens}
              onChange={(e) => onUpdateField('maxOutputTokens', e.target.value)}
              placeholder={t('emptyMeansDisabled')}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">{t('metadataJson')}</label>
            <Textarea
              rows={6}
              value={form.metadataJson}
              onChange={(e) => onUpdateField('metadataJson', e.target.value)}
              placeholder={t('metadataJsonPlaceholder')}
              className="font-mono text-xs"
            />
            {metadataError && <p className="text-xs text-destructive mt-1">{metadataError}</p>}
          </div>
        </>
      )}
    </>
  );
}
