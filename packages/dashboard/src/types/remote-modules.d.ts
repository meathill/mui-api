/**
 * unpkg 上远程 ESM 模块的类型声明。
 *
 * ⚠️ 这里的 URL 必须与 `src/components/marketing/awesome-comment.tsx` 里的 import() 字面量
 * 逐字一致——TS 按字符串精确匹配模块声明，改版本号时两边都要改。
 */

declare module 'https://unpkg.com/@roudanio/awesome-auth@0.1.5/dist/awesome-auth.js' {
  export function getInstance(options: { googleId: string; root: string; prefix?: string }): unknown;
}

declare module 'https://unpkg.com/@roudanio/awesome-comment@0.12.0/dist/awesome-comment.js' {
  const AwesomeComment: {
    init: (
      root: HTMLElement,
      options: {
        postId: string;
        siteId: string;
        apiUrl: string;
        awesomeAuth: unknown;
        locale?: string;
        turnstileSiteKey?: string;
        autoFocus?: boolean;
      },
    ) => void;
  };
  export default AwesomeComment;
}
