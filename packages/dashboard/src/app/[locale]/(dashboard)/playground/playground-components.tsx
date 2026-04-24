'use client';

import { DownloadIcon, Trash2Icon, UploadIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { HistoryItem, ImageResult, PlaygroundMode } from './playground-types';
import { downloadImage } from './playground-utils';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

export function PromptField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={7} placeholder={placeholder} />
    </Field>
  );
}

export function ImageUpload({
  files,
  onChange,
  onRemove,
}: {
  files: File[];
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  const t = useTranslations('playground');

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
        <UploadIcon className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">{t('uploadImages')}</span>
        <span className="text-xs text-muted-foreground">{t('uploadHint')}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => onChange(event.target.files)}
        />
      </label>
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <button
              key={`${file.name}-${file.lastModified}`}
              type="button"
              onClick={() => onRemove(index)}
              className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {file.name}
              <XIcon className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ImageResults({
  results,
  emptyLabel,
  saveLabel,
}: {
  results: ImageResult[];
  emptyLabel: string;
  saveLabel: string;
}) {
  if (results.length === 0) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {results.map((image) => (
        <div key={image.id} className="overflow-hidden rounded-lg border border-border bg-muted">
          <img src={image.src} alt="" className="aspect-square w-full object-contain" />
          <div className="flex items-center justify-between gap-2 bg-background p-2">
            <span className="truncate text-xs text-muted-foreground">{image.filename}</span>
            <Button size="sm" variant="outline" onClick={() => downloadImage(image)}>
              <DownloadIcon />
              {saveLabel}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistoryList({
  history,
  onClear,
  onRestore,
}: {
  history: HistoryItem[];
  onClear: () => void;
  onRestore: (item: HistoryItem) => void;
}) {
  const t = useTranslations('playground');

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('history')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('historyHint')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClear} disabled={history.length === 0}>
          <Trash2Icon />
          {t('clearHistory')}
        </Button>
      </div>

      {history.length === 0 ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('emptyHistory')}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {history.map((item) => (
            <HistoryButton key={item.id} item={item} onRestore={onRestore} />
          ))}
        </div>
      )}
    </>
  );
}

function HistoryButton({ item, onRestore }: { item: HistoryItem; onRestore: (item: HistoryItem) => void }) {
  const t = useTranslations('playground');
  const modeLabel: Record<PlaygroundMode, string> = {
    chat: t('chatMode'),
    image: t('imageMode'),
  };

  return (
    <button
      type="button"
      onClick={() => onRestore(item)}
      className="rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{modeLabel[item.mode]}</span>
        <span>{new Date(item.createdAt).toLocaleString()}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {item.model}
        {item.imageCount ? ` · ${t('imageCount', { count: item.imageCount })}` : ''}
      </p>
    </button>
  );
}
