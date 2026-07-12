'use client';

import {
  GROK_VIDEO_ASPECT_RATIOS,
  GROK_VIDEO_DURATION_MAX,
  GROK_VIDEO_DURATION_MIN,
  getGrokVideoResolutions,
  isGrokVideoModelId,
} from '@muirouter/shared-db/grok-video';
import { DownloadIcon, LoaderCircleIcon, UploadIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from './playground-components';
import type { GrokVideoOptions, VideoResult, VideoStatus } from './playground-types';
import { downloadVideo } from './playground-utils';

export function GrokVideoControls({
  model,
  options,
  image,
  onChange,
  onImageChange,
}: {
  model: string;
  options: GrokVideoOptions;
  image: File | null;
  onChange: (options: GrokVideoOptions) => void;
  onImageChange: (file: File | null) => void;
}) {
  const t = useTranslations('playground');
  const resolutions = isGrokVideoModelId(model) ? getGrokVideoResolutions(model) : ['480p'];
  const requiresImage = model === 'grok-imagine-video-1.5';
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('videoDuration')}>
          <select
            value={options.duration}
            onChange={(event) => onChange({ ...options, duration: Number(event.target.value) })}
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
          >
            {Array.from({ length: GROK_VIDEO_DURATION_MAX - GROK_VIDEO_DURATION_MIN + 1 }, (_, index) => index + 1).map(
              (duration) => (
                <option key={duration} value={duration}>
                  {t('videoSeconds', { count: duration })}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label={t('imageAspectRatio')}>
          <select
            value={options.aspectRatio}
            onChange={(event) =>
              onChange({ ...options, aspectRatio: event.target.value as GrokVideoOptions['aspectRatio'] })
            }
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
          >
            {GROK_VIDEO_ASPECT_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('imageResolution')}>
          <select
            value={options.resolution}
            onChange={(event) =>
              onChange({ ...options, resolution: event.target.value as GrokVideoOptions['resolution'] })
            }
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-xs"
          >
            {resolutions.map((resolution) => (
              <option key={resolution} value={resolution}>
                {resolution}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 text-center">
          <UploadIcon className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">{t('videoUploadImage')}</span>
          <span className="text-xs text-muted-foreground">
            {requiresImage ? t('videoImageRequired') : t('videoImageOptional')}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => onImageChange(event.target.files?.[0] ?? null)}
          />
        </label>
        {image && (
          <button
            type="button"
            onClick={() => onImageChange(null)}
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs text-muted-foreground"
          >
            {image.name}
            <XIcon className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function VideoResultView({
  result,
  status,
  progress,
}: {
  result: VideoResult | null;
  status: VideoStatus;
  progress: number | null;
}) {
  const t = useTranslations('playground');
  if (status === 'pending') {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-lg bg-muted text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-6 animate-spin" />
        <span>{progress == null ? t('videoPending') : t('videoProgress', { progress })}</span>
      </div>
    );
  }
  if (!result) {
    const terminalLabel = status === 'failed' ? t('videoStatusFailed') : t('videoStatusExpired');
    return (
      <div className="flex min-h-72 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        {status === 'failed' || status === 'expired' ? terminalLabel : t('videoPlaceholder')}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted">
      <video controls src={result.url} className="max-h-[32rem] w-full bg-muted" />
      <div className="flex flex-wrap items-center justify-between gap-2 bg-background p-3">
        <p className="text-xs text-muted-foreground">{t('videoTemporaryHint')}</p>
        <Button size="sm" variant="outline" onClick={() => downloadVideo(result.url)}>
          <DownloadIcon />
          {t('saveVideo')}
        </Button>
      </div>
    </div>
  );
}
