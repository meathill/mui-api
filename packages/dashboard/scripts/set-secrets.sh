#!/bin/bash
# 为 Dashboard Worker 设置 secrets
# 使用方法: bash scripts/set-secrets.sh
# 需要在 .dev.vars 中设置好对应的值

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_VARS="$SCRIPT_DIR/../.dev.vars"

if [ ! -f "$DEV_VARS" ]; then
  echo "错误: 未找到 .dev.vars 文件"
  echo "请创建 $DEV_VARS 并设置以下变量:"
  echo "  BETTER_AUTH_SECRET=xxx"
  echo "  ADMIN_SECRET=xxx"
  echo "  ADMIN_EMAILS=admin@example.com"
  exit 1
fi

echo "正在为 mui-dashboard 设置 secrets..."

while IFS='=' read -r key value; do
  # 跳过空行和注释
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  # 跳过 NEXT_PUBLIC_ 前缀的变量（构建时烧录）
  [[ "$key" =~ ^NEXT_PUBLIC_ ]] && continue

  echo "设置 $key..."
  echo "$value" | npx wrangler secret put "$key" --name mui-dashboard 2>/dev/null
done < "$DEV_VARS"

echo "✅ 所有 secrets 设置完成"
