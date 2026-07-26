/**
 * 模型表单的数据形状。
 * 单独成文件是为了让 model-form-dialog 与 model-metadata-fields 都能引用而不成环。
 * 所有字段都是字符串——受控表单直接绑 input.value，空字符串表示未配置 / 缺省。
 */
export interface ModelFormData {
  id: string;
  provider: string;
  upstreamModelId: string;
  inputPrice: string;
  outputPrice: string;
  markupRate: string;
  // 对外元数据：喂 GET /v1/models 与 models.dev 的 TOML 生成器
  displayName: string;
  contextLength: string;
  maxOutputTokens: string;
  metadataJson: string;
  // 高级定价：空字符串表示未启用
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
  displayName: '',
  contextLength: '',
  maxOutputTokens: '',
  metadataJson: '',
  cachedInputPrice: '',
  cacheWritePrice: '',
  longContextThresholdTokens: '',
  longContextInputPrice: '',
  longContextCachedInputPrice: '',
  longContextCacheWritePrice: '',
  longContextOutputPrice: '',
};
