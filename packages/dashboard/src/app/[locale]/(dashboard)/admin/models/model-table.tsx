'use client';

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ModelInfo } from '@/lib/api';

export type SortField = 'id' | 'provider' | 'inputPrice' | 'outputPrice' | 'markupRate';
export type SortDirection = 'asc' | 'desc';

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

export function ModelTable({
  models,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  hasSearch,
}: {
  models: ModelInfo[];
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEdit: (model: ModelInfo) => void;
  onDelete: (id: string) => void;
  hasSearch: boolean;
}) {
  const t = useTranslations('adminModels');

  const SORTABLE_COLUMNS: { field: SortField; label: string; align?: string }[] = [
    { field: 'id', label: t('colModelId') },
    { field: 'provider', label: t('colProvider') },
    { field: 'inputPrice', label: t('colInputPrice'), align: 'text-right' },
    { field: 'outputPrice', label: t('colOutputPrice'), align: 'text-right' },
    { field: 'markupRate', label: t('colMarkupRate'), align: 'text-right' },
  ];

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            {SORTABLE_COLUMNS.map((col) => (
              <TableHead
                key={col.field}
                className={`cursor-pointer select-none hover:bg-muted/50 ${col.align ?? ''}`}
                onClick={() => onSort(col.field)}
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
          {models.map((model) => (
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
                <Button variant="ghost" size="xs" onClick={() => onEdit(model)}>
                  {t('edit')}
                </Button>
                <Button variant="ghost" size="xs" className="text-destructive" onClick={() => onDelete(model.id)}>
                  {t('delete')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {models.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {hasSearch ? t('noMatch') : t('empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
