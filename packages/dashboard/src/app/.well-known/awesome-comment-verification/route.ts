import { connection } from 'next/server';
import { getKV } from '@/lib/kv';

/**
 * Awesome Comment 的域名归属验证端点。
 *
 * awesomecomment.org 会抓这个地址并比对明文 token，通过后 muirouter.com 才被允许调用评论接口
 * （生产 DOMAIN_VERIFY_MODE=any，未验证域名一律 403）。
 *
 * token 从 KV 读而不是写死在代码里：签发的 token 只有 30 分钟有效期，写死意味着每次都要在
 * 这个窗口内跑完一整轮 opennextjs build + deploy。放 KV 后换 token 只需一条
 * `wrangler kv key put`，秒级生效。
 *
 * 放在 src/app/ 而非 src/app/[locale]/，避免带上语言前缀；middleware 的 matcher
 * `/((?!api|_next|_vercel|.*\..*).*)` 里的 `.*\..*` 会跳过含点的路径，正合需要。
 */

const TOKEN_KEY = 'awesome-comment:domain-verify-token';

export async function GET(): Promise<Response> {
  await connection();
  const kv = await getKV();
  const token = await kv.get(TOKEN_KEY);

  if (!token) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(token, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
