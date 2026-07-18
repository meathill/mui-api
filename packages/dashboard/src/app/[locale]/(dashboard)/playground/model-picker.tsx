'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CaretUpDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxFilter,
} from '@/components/ui/combobox';
import type { ModelInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { groupModelsByProvider, type ModelGroup, PROVIDER_LABELS } from './playground-model-catalog';
import { formatModelPrice, getGrokImagePrice, getModelCapabilityTagKeys, getModelPrice } from './playground-utils';

type ModelPickerProps = {
  models: ModelInfo[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function ModelPicker(props: ModelPickerProps) {
  const t = useTranslations('playground');
  const [search, setSearch] = React.useState('');
  const filter = useComboboxFilter({ value: props.value });

  const modelById = React.useMemo(() => {
    const map = new Map<string, ModelInfo>();
    for (const model of props.models) {
      map.set(model.id, model);
    }
    return map;
  }, [props.models]);

  const groups = React.useMemo(() => groupModelsByProvider(props.models), [props.models]);

  // 搜索匹配 id + provider（含显示名）+ 标签文案，而非仅 id。
  const toSearchText = React.useCallback(
    (id: string) => {
      const model = modelById.get(id);
      if (!model) return id;
      const tags = getModelCapabilityTagKeys(model)
        .map((key) => t(key))
        .join(' ');
      return `${model.id} ${model.provider} ${PROVIDER_LABELS[model.provider] ?? ''} ${tags}`;
    },
    [modelById, t],
  );

  const filteredGroups = React.useMemo<ModelGroup[]>(() => {
    if (!search.trim()) return groups;
    return groups
      .map((group) => ({
        provider: group.provider,
        items: group.items.filter((id) => filter.contains(id, search, toSearchText)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, search, filter, toSearchText]);

  const hasModels = props.models.length > 0;
  const placeholder = hasModels ? t('selectModel') : t('noModels');

  return (
    <Combobox<string>
      items={groups}
      filteredItems={filteredGroups}
      value={props.value}
      onValueChange={(next) => props.onValueChange(next ?? '')}
      inputValue={search}
      onInputValueChange={(next) => setSearch(next)}
      autoHighlight
      disabled={!hasModels}
    >
      <ComboboxTrigger
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1 text-left text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 disabled:opacity-64',
          props.className,
        )}
      >
        <ComboboxValue>
          {(selected: string | null) => {
            const model = selected ? modelById.get(selected) : undefined;
            if (!model) {
              return <span className="truncate text-muted-foreground">{placeholder}</span>;
            }
            return (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{model.id}</span>
                {getModelCapabilityTagKeys(model).map((key) => (
                  <Badge key={key} variant="secondary" size="sm">
                    {t(key)}
                  </Badge>
                ))}
              </span>
            );
          }}
        </ComboboxValue>
        <CaretUpDown className="size-4 shrink-0 opacity-60" />
      </ComboboxTrigger>

      <ComboboxPopup>
        <div className="border-b p-1.5">
          <ComboboxPrimitive.Input
            className="h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t('searchModels')}
          />
        </div>
        <ComboboxEmpty>{t('noModelsFound')}</ComboboxEmpty>
        <ComboboxList>
          {(group: ModelGroup) => (
            <ComboboxGroup key={group.provider} items={group.items}>
              <ComboboxGroupLabel>{PROVIDER_LABELS[group.provider] ?? group.provider}</ComboboxGroupLabel>
              <ComboboxCollection>
                {(id: string) => <ModelOption key={id} model={modelById.get(id)} />}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

function ModelOption({ model }: { model: ModelInfo | undefined }) {
  const t = useTranslations('playground');
  if (!model) return null;

  const tags = getModelCapabilityTagKeys(model);
  const grokImagePrice = getGrokImagePrice(model);
  const price = getModelPrice(model);
  const priceLabel =
    grokImagePrice !== null
      ? grokImagePrice.outputImagePrices['1k'] === grokImagePrice.outputImagePrices['2k']
        ? t('imagePriceLabel', {
            input: formatModelPrice(grokImagePrice.inputImagePrice),
            output: formatModelPrice(grokImagePrice.outputImagePrices['1k']),
          })
        : t('imageTieredPriceLabel', {
            input: formatModelPrice(grokImagePrice.inputImagePrice),
            output1k: formatModelPrice(grokImagePrice.outputImagePrices['1k']),
            output2k: formatModelPrice(grokImagePrice.outputImagePrices['2k']),
          })
      : price === null
        ? null
        : price.input === 0 && price.output === 0
          ? t('priceFree')
          : t('priceLabel', { input: formatModelPrice(price.input), output: formatModelPrice(price.output) });

  return (
    <ComboboxItem value={model.id}>
      <div className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{model.id}</span>
          {tags.map((key) => (
            <Badge key={key} variant="outline" size="sm">
              {t(key)}
            </Badge>
          ))}
        </span>
        {priceLabel && <span className="text-xs text-muted-foreground">{priceLabel}</span>}
      </div>
    </ComboboxItem>
  );
}
