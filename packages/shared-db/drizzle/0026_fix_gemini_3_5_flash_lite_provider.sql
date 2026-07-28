-- 修正数据录入错误：gemini-3.5-flash-lite 的 provider 被错填成 openai，
-- 两个同批加入的兄弟模型（gemini-3.5-flash / gemini-3.6-flash）都是
-- google-ai-studio。错的这行会把请求打到 OpenAI API 上，upstream 那边没有
-- 这个模型名，直接报错——不会算错钱，但用户调不通。

UPDATE models SET provider = 'google-ai-studio' WHERE id = 'gemini-3.5-flash-lite';
