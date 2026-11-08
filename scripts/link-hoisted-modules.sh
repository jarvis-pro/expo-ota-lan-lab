#!/bin/bash
# pnpm node-linker=hoisted 会把 workspace 内所有依赖提升到仓库根 node_modules,
# 子包自己的 node_modules 不再存在; 而生成的 iOS 工程里保留了 ota-demo/../node_modules
# 形式的相对引用 (Pods 工程、HERMES_CLI_PATH 等)。
# 这里用符号链接把这些相对引用指回根 node_modules, 对齐 npm 时代的布局。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in ota-demo server; do
  link="$ROOT/$pkg/node_modules"
  if [ -L "$link" ] || [ -d "$link" ]; then
    continue   # 已存在（符号链接或 pnpm 自建目录）则不动
  fi
  ln -s ../node_modules "$link"
  echo "link-hoisted-modules: $pkg/node_modules -> ../node_modules"
done
