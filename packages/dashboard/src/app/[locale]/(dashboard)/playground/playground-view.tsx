'use client';

import { ImageIcon, LoaderCircleIcon, MessageSquareIcon, SaveIcon, VideoIcon, Volume2Icon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import type { ModelInfo } from '@/lib/api';
import { ModelPicker } from './model-picker';
import {
  AudioResultView,
  Field,
  GrokImageControls,
  HistoryList,
  ImageResults,
  ImageUpload,
  PromptField,
  TtsControls,
} from './playground-components';
import { GrokVideoControls, VideoResultView } from './playground-video-components';
import type {
  AudioResult,
  GrokImageOptions,
  GrokVideoOptions,
  HistoryItem,
  ImageResult,
  PlaygroundMode,
  TokenInfo,
  VideoResult,
  VideoStatus,
} from './playground-types';

type PlaygroundViewProps = {
  mode: PlaygroundMode;
  visibleModels: ModelInfo[];
  selectedModel: string;
  apiKey: string;
  prompt: string;
  ttsModel: string;
  ttsStylePrompt: string;
  ttsVoice: string;
  voiceSample: File | null;
  uploadedImages: File[];
  isGrokImage: boolean;
  grokImageOptions: GrokImageOptions;
  videoModel: string;
  grokVideoOptions: GrokVideoOptions;
  videoImage: File | null;
  loading: boolean;
  error: string;
  response: string;
  imageResults: ImageResult[];
  audioResult: AudioResult | null;
  videoResult: VideoResult | null;
  videoStatus: VideoStatus;
  videoProgress: number | null;
  tokenInfo: TokenInfo | null;
  history: HistoryItem[];
  onModeChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onTtsStylePromptChange: (value: string) => void;
  onTtsVoiceChange: (value: string) => void;
  onVoiceSampleChange: (file: File | null) => void;
  onFilesChange: (files: FileList | null) => void;
  onRemoveUpload: (index: number) => void;
  onClearUploads: () => void;
  onGrokImageOptionsChange: (options: GrokImageOptions) => void;
  onGrokVideoOptionsChange: (options: GrokVideoOptions) => void;
  onVideoImageChange: (file: File | null) => void;
  onRun: () => void;
  onStop: () => void;
  onClearHistory: () => void;
  onRestoreHistory: (item: HistoryItem) => void;
};

export function PlaygroundView(props: PlaygroundViewProps) {
  const t = useTranslations('playground');

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Dashboard · Playground"
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Tabs value={props.mode} onValueChange={props.onModeChange}>
            <TabsList>
              <TabsTab value="chat">
                <MessageSquareIcon />
                {t('chatMode')}
              </TabsTab>
              <TabsTab value="image">
                <ImageIcon />
                {t('imageMode')}
              </TabsTab>
              <TabsTab value="video">
                <VideoIcon />
                {t('videoMode')}
              </TabsTab>
              <TabsTab value="tts">
                <Volume2Icon />
                {t('ttsMode')}
              </TabsTab>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <Card className="p-4">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('model')}>
                <ModelPicker
                  models={props.visibleModels}
                  value={props.selectedModel}
                  onValueChange={props.onModelChange}
                />
              </Field>

              <Field label={t('apiKey')}>
                <Input
                  nativeInput
                  type="password"
                  value={props.apiKey}
                  onChange={(event) => props.onApiKeyChange(event.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('apiKeyHint')}</p>
              </Field>
            </div>

            <Tabs value={props.mode} onValueChange={props.onModeChange}>
              <TabsPanel value="chat">
                <PromptField
                  value={props.prompt}
                  onChange={props.onPromptChange}
                  label={t('prompt')}
                  placeholder={t('promptPlaceholder')}
                />
              </TabsPanel>
              <TabsPanel value="image" className="space-y-4">
                <PromptField
                  value={props.prompt}
                  onChange={props.onPromptChange}
                  label={t('imagePrompt')}
                  placeholder={t('imagePromptPlaceholder')}
                />
                {props.isGrokImage && (
                  <GrokImageControls
                    options={props.grokImageOptions}
                    isEditing={props.uploadedImages.length > 0}
                    onChange={props.onGrokImageOptionsChange}
                  />
                )}
                <ImageUpload
                  files={props.uploadedImages}
                  onChange={props.onFilesChange}
                  onRemove={props.onRemoveUpload}
                />
              </TabsPanel>
              <TabsPanel value="video" className="space-y-4">
                <PromptField
                  value={props.prompt}
                  onChange={props.onPromptChange}
                  label={t('videoPrompt')}
                  placeholder={t('videoPromptPlaceholder')}
                />
                <GrokVideoControls
                  model={props.videoModel}
                  options={props.grokVideoOptions}
                  image={props.videoImage}
                  onChange={props.onGrokVideoOptionsChange}
                  onImageChange={props.onVideoImageChange}
                />
              </TabsPanel>
              <TabsPanel value="tts" className="space-y-4">
                {props.ttsModel && (
                  <TtsControls
                    model={props.ttsModel}
                    stylePrompt={props.ttsStylePrompt}
                    onStylePromptChange={props.onTtsStylePromptChange}
                    voice={props.ttsVoice}
                    onVoiceChange={props.onTtsVoiceChange}
                    voiceSample={props.voiceSample}
                    onVoiceSampleChange={props.onVoiceSampleChange}
                  />
                )}
                <PromptField
                  value={props.prompt}
                  onChange={props.onPromptChange}
                  label={t('ttsPrompt')}
                  placeholder={t('ttsPromptPlaceholder')}
                />
              </TabsPanel>
            </Tabs>

            <div className="flex flex-wrap gap-2">
              {props.loading ? (
                <Button variant="destructive" onClick={props.onStop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button
                  onClick={props.onRun}
                  disabled={!props.prompt.trim() || !props.apiKey.trim() || !props.selectedModel}
                >
                  {props.mode === 'chat'
                    ? t('send')
                    : props.mode === 'image'
                      ? t('generateImage')
                      : props.mode === 'video'
                        ? props.videoStatus === 'pending'
                          ? t('resumeVideo')
                          : t('generateVideo')
                        : t('generateTts')}
                </Button>
              )}
              {props.loading && props.mode !== 'chat' && (
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {props.mode === 'image'
                    ? t('generating')
                    : props.mode === 'video'
                      ? t('videoPending')
                      : t('ttsGenerating')}
                </span>
              )}
              {props.mode === 'image' && props.uploadedImages.length > 0 && (
                <Button variant="outline" onClick={props.onClearUploads}>
                  <XIcon />
                  {t('clearUploads')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-sm font-medium">
              {props.mode === 'chat'
                ? t('response')
                : props.mode === 'image'
                  ? t('imageResult')
                  : props.mode === 'video'
                    ? t('videoResult')
                    : t('ttsResult')}
            </label>
            {props.mode === 'image' && props.imageResults.length > 0 && (
              <span className="text-xs text-muted-foreground">
                <SaveIcon className="mr-1 inline size-3.5" />
                {t('imageSaveHint')}
              </span>
            )}
            {props.mode === 'tts' && props.audioResult && (
              <span className="text-xs text-muted-foreground">
                <SaveIcon className="mr-1 inline size-3.5" />
                {t('ttsSaveHint')}
              </span>
            )}
          </div>

          {props.error && <p className="mb-3 text-sm text-destructive">{props.error}</p>}

          {props.mode === 'chat' ? (
            <div className="min-h-72 rounded-lg bg-muted p-3 font-mono text-sm whitespace-pre-wrap">
              {props.response || <span className="text-muted-foreground">{t('responsePlaceholder')}</span>}
            </div>
          ) : props.mode === 'image' ? (
            <ImageResults results={props.imageResults} emptyLabel={t('imagePlaceholder')} saveLabel={t('saveImage')} />
          ) : props.mode === 'video' ? (
            <VideoResultView result={props.videoResult} status={props.videoStatus} progress={props.videoProgress} />
          ) : (
            <AudioResultView result={props.audioResult} emptyLabel={t('ttsPlaceholder')} saveLabel={t('saveAudio')} />
          )}

          {props.tokenInfo && (
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span>{t('inputTokens', { count: props.tokenInfo.inputTokens })}</span>
              <span>{t('outputTokens', { count: props.tokenInfo.outputTokens })}</span>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <HistoryList history={props.history} onClear={props.onClearHistory} onRestore={props.onRestoreHistory} />
      </Card>
    </div>
  );
}
