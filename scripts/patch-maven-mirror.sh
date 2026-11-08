#!/bin/bash
# 把 RN 预编译产物的下载源从 repo.reactnative.dev 替换为 Maven Central
# （该域名在本网络环境几乎不可用, 详见 docs/06-troubleshooting.md 第 3 条）
# 已挂在根 package.json 的 postinstall 上, pnpm install 后自动执行; 也可手动运行。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

TARGETS=$(grep -rl "https://repo.reactnative.dev/maven2" "$ROOT/node_modules" \
  --include="*.rb" --include="*.podspec" 2>/dev/null || true)

if [ -z "$TARGETS" ]; then
  echo "patch-maven-mirror: 无需补丁（未找到 repo.reactnative.dev 引用）"
  exit 0
fi

echo "$TARGETS" | while IFS= read -r f; do
  # pnpm 的 node_modules 含符号链接, sed -i 会先解引用再落盘, 避免链接被破坏
  real=$(realpath "$f")
  sed -i '' 's|https://repo.reactnative.dev/maven2|https://repo1.maven.org/maven2|g' "$real"
  echo "patch-maven-mirror: 已补丁 ${f#"$ROOT"/}"
done
