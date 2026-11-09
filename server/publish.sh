#!/bin/bash
# 一键发布 OTA 更新到局域网服务器
# 用法: ./publish.sh [rollback]
#   无参数: 在 ../ota-demo 执行 expo export 并发布为新更新
#   rollback: 发布一条"回滚到内置包"指令
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../ota-demo" && pwd)"
SERVER_DIR="$(cd "$(dirname "$0")" && pwd)"

RUNTIME_VERSION=$(node -p "
  const rv = require('$APP_DIR/app.json').expo.runtimeVersion;
  typeof rv === 'string' ? rv : (() => { throw new Error('runtimeVersion 必须是字符串, 当前策略不支持自动展开'); })();
")

TS=$(node -e "console.log(Date.now())")
TARGET="$SERVER_DIR/updates/$RUNTIME_VERSION/$TS"
mkdir -p "$TARGET"

if [ "${1:-}" = "rollback" ]; then
  touch "$TARGET/rollback"
  echo "已发布回滚指令: updates/$RUNTIME_VERSION/$TS/rollback"
  exit 0
fi

echo "==> 导出更新包 (expo export)"
(cd "$APP_DIR" && pnpm exec expo export)

echo "==> 拷贝到 updates/$RUNTIME_VERSION/$TS"
cp -r "$APP_DIR/dist/"* "$TARGET/"

echo "==> 生成 expo-config.json"
node "$SERVER_DIR/export-config.ts" "$APP_DIR" > "$TARGET/expo-config.json"

echo "发布完成: updates/$RUNTIME_VERSION/$TS"
