'use client';

import {
  GROK_IMAGE_ASPECT_RATIOS,
  GROK_IMAGE_MAX_OUTPUTS,
  GROK_IMAGE_RESOLUTIONS,
} from '@muirouter/shared-db/grok-image';
import { Download, Trash, Upload, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AudioResult, GrokImageOptions, HistoryItem, ImageResult, PlaygroundMode } from './playground-types';
import { downloadAudio, downloadImage } from './playground-media-results';
import { getTtsVoiceOptions, isTtsVoiceCloneModel } from './playground-tts';

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
  accept = 'image/png,image/jpeg,image/webp',
  titleKey = 'uploadImages',
  hintKey = 'uploadHint',
}: {
  files: File[];
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  accept?: string;
  titleKey?: string;
  hintKey?: string;
}) {
  const t = useTranslations('playground');

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
        <Upload className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">{t(titleKey)}</span>
        <span className="text-xs text-muted-foreground">{t(hintKey)}</span>
        <input
          type="file"
          accept={accept}
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
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function GrokImageControls({
  options,
  isEditing,
  onChange,
}: {
  options: GrokImageOptions;
  isEditing: boolean;
  onChange: (options: GrokImageOptions) => void;
}) {
  const t = useTranslations('playground');
  return (
    <div className={isEditing ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-3'}>
      {!isEditing && (
        <Field label={t('imageCountLabel')}>
          <select
            value={options.count}
            onChange={(event) => onChange({ ...options, count: Number(event.target.value) })}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
          >
            {Array.from({ length: GROK_IMAGE_MAX_OUTPUTS }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t('imageAspectRatio')}>
        <select
          value={options.aspectRatio}
          onChange={(event) =>
            onChange({ ...options, aspectRatio: event.target.value as GrokImageOptions['aspectRatio'] })
          }
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
        >
          {GROK_IMAGE_ASPECT_RATIOS.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio === 'auto' ? t('imageAspectRatioAuto') : ratio}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('imageResolution')}>
        <select
          value={options.resolution}
          onChange={(event) =>
            onChange({ ...options, resolution: event.target.value as GrokImageOptions['resolution'] })
          }
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
        >
          {GROK_IMAGE_RESOLUTIONS.map((resolution) => (
            <option key={resolution} value={resolution}>
              {resolution.toUpperCase()}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function TtsControls({
  model,
  stylePrompt,
  onStylePromptChange,
  voice,
  onVoiceChange,
  voiceSample,
  onVoiceSampleChange,
}: {
  model: string;
  stylePrompt: string;
  onStylePromptChange: (value: string) => void;
  voice: string;
  onVoiceChange: (value: string) => void;
  voiceSample: File | null;
  onVoiceSampleChange: (file: File | null) => void;
}) {
  const t = useTranslations('playground');
  const voiceOptions = getTtsVoiceOptions(model);
  const needsVoiceSample = isTtsVoiceCloneModel(model);

  return (
    <div className="space-y-4">
      {voiceOptions.length > 0 && (
        <Field label={t('ttsVoice')}>
          <select
            value={voice}
            onChange={(event) => onVoiceChange(event.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors"
          >
            {voiceOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {needsVoiceSample && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">{t('ttsVoiceSampleUpload')}</span>
            <span className="text-xs text-muted-foreground">{t('ttsVoiceSampleHint')}</span>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,.mp3,.wav"
              className="sr-only"
              onChange={(event) => onVoiceSampleChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {voiceSample && (
            <button
              type="button"
              onClick={() => onVoiceSampleChange(null)}
              className="mt-3 inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground"
            >
              {voiceSample.name}
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <Field label={t('ttsStylePrompt')}>
        <Textarea
          value={stylePrompt}
          onChange={(event) => onStylePromptChange(event.target.value)}
          rows={3}
          placeholder={t('ttsStylePlaceholder')}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t('ttsStyleHint')}</p>
      </Field>
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
              <Download />
              {saveLabel}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AudioResultView({
  result,
  emptyLabel,
  saveLabel,
}: {
  result: AudioResult | null;
  emptyLabel: string;
  saveLabel: string;
}) {
  if (!result) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <audio controls src={result.src} className="w-full" />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{result.filename}</span>
        <Button size="sm" variant="outline" onClick={() => downloadAudio(result)}>
          <Download />
          {saveLabel}
        </Button>
      </div>
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
          <Trash />
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
    video: t('videoMode'),
    tts: t('ttsMode'),
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
        {item.audioFilename ? ` · ${item.audioFilename}` : ''}
        {item.videoStatus
          ? ` · ${t(`videoStatus${item.videoStatus[0].toUpperCase()}${item.videoStatus.slice(1)}`)}`
          : ''}
      </p>
    </button>
  );
}
