-- 新增 Xiaomi MiMo TTS 模型。
-- 官方当前标记为限时免费，因此 input_price / output_price 暂记为 0。
-- 后续官方开始收费时，需要同步更新种子数据和生产库价格。
INSERT OR REPLACE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES
  ('mimo-v2.5-tts', 'xiaomi-mimo', 'mimo-v2.5-tts', 0, 0, 1.2),
  ('mimo-v2.5-tts-voiceclone', 'xiaomi-mimo', 'mimo-v2.5-tts-voiceclone', 0, 0, 1.2),
  ('mimo-v2.5-tts-voicedesign', 'xiaomi-mimo', 'mimo-v2.5-tts-voicedesign', 0, 0, 1.2),
  ('mimo-v2-tts', 'xiaomi-mimo', 'mimo-v2-tts', 0, 0, 1.2);
