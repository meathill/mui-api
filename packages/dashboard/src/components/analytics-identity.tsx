'use client';

import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { consumePendingSignUp, setAnalyticsUserId, trackSignUp } from '@/lib/analytics';
import { userApi } from '@/lib/api';

/** 账号创建后多久内仍视为"本次注册"，超过则丢弃待补发的 sign_up 标记。 */
const FRESH_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

/**
 * 登录态 GA 身份粘合（挂在 dashboard layout 下）：
 * 1. 社交登录是 OAuth 跳转，注册成功无法在点击时确认——按钮点击时只记 pending，
 *    这里用账号创建时间判断是否为新注册，是则补发 sign_up（同一 client_id 下归因不断）。
 * 2. 登录后绑定 user_id，把登录前 Organic 落地会话与登录后行为连起来。
 */
export function AnalyticsIdentity() {
  const { data: session } = useSession();

  useEffect(() => {
    const pending = consumePendingSignUp();
    if (pending) {
      userApi
        .getProfile()
        .then(({ user }) => {
          if (!user.createdAt) return;
          if (Date.now() - new Date(user.createdAt).getTime() <= FRESH_ACCOUNT_WINDOW_MS) {
            trackSignUp(pending);
          }
        })
        .catch(() => {
          // 画像请求失败时不补发，避免误伤老用户
        });
    }
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (userId) setAnalyticsUserId(userId);
  }, [session?.user?.id]);

  return null;
}
