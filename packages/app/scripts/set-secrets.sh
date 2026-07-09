#!/bin/bash
# 批量设置 Cloudflare Worker Secrets
# 用法: bash scripts/set-secrets.sh
# 脚本会从 .dev.vars 读取变量，逐个设置为 secret

set -e

VARS_FILE=".dev.vars"

if [ ! -f "$VARS_FILE" ]; then
  echo "错误: $VARS_FILE 文件不存在"
  exit 1
fi

# 需要设为 secret 的变量名列表
SECRETS=(
  CF_AIG_TOKEN
  RESEND_API_KEY
  ADMIN_SECRET
  ADMIN_EMAIL
  BASE_URL
  FROM_EMAIL
  CF_ACCOUNT_ID
  CF_GATEWAY_ID
  CF_TOKEN
  MIMO_API_KEY
  ANTHROPIC_API_KEY
)

echo "正在从 $VARS_FILE 读取并设置 secrets..."
echo ""

for SECRET_NAME in "${SECRETS[@]}"; do
  # 从 .dev.vars 中提取值
  VALUE=$(grep "^${SECRET_NAME}=" "$VARS_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)

  if [ -z "$VALUE" ]; then
    echo "⏭️  跳过 $SECRET_NAME (未在 $VARS_FILE 中找到或为空)"
    continue
  fi

  echo "🔐 设置 $SECRET_NAME ..."
  echo "$VALUE" | npx wrangler secret put "$SECRET_NAME"
  echo ""
done

echo "✅ 完成！"
echo ""
echo "请确认 .dev.vars 中包含以下变量（缺少的需要手动添加后重新运行）:"
for SECRET_NAME in "${SECRETS[@]}"; do
  echo "  - $SECRET_NAME"
done
