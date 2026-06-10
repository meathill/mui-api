/**
 * 打印全量模型的 upsert SQL（INSERT OR REPLACE，含新上架的模型），供应用到远程 D1。
 * 纯函数、不读 .env、不联网，只往 stdout 写 SQL。
 *
 * 用法：
 *   node packages/app/scripts/print-seed-sql.ts > seed-models.sql
 *   wrangler d1 execute mui-api --remote --file=seed-models.sql
 *   wrangler kv key delete --binding=KV models:catalog   # 清目录缓存，否则旧价兜底 ~60s
 */

import { generateSeedSQL } from '../src/db/seed.ts';

process.stdout.write(`${generateSeedSQL()}\n`);
