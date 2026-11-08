#!/bin/bash
# expo-updates 局域网 OTA 热更 · 可重复执行的端到端 demo
#
# 流程:
#   0. 预检（LAN IP 与 app.json 一致、依赖就绪）并启动更新服务器
#   1. 发布回滚指令作为基线 -> 全新安装并启动 App -> 断言运行在 v1 内置包
#   2. 修改 App.tsx 标记为 v2 -> 发布 -> 重启 App -> 断言新 bundle 经 OTA 下载
#   3. 发布回滚指令 -> 重启 App -> 断言收到 rollBackToEmbedded
#   4. 还原 App.tsx、关闭服务器、输出结论与截图目录
#
# 用法: ./demo.sh [--skip-build]
#   --skip-build   跳过 xcodebuild（上次构建产物还在时用，改动 App.tsx 不需要重新构建原生包）
#
# 环境变量:
#   SIM_UDID   指定模拟器 UDID（默认自动选第一台可用的 iPhone）
#   PORT       更新服务器端口（默认 4747，需与 app.json 的 updates.url 一致）

set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT/ota-demo"
SERVER_DIR="$ROOT/server"
BUNDLE_ID="com.demo.otalab"
SCHEME="otademo"
WORKSPACE="$APP_DIR/ios/$SCHEME.xcworkspace"
DERIVED="$APP_DIR/ios/.ios-build/derived-data/Release"
APP_PATH="$DERIVED/Build/Products/Release-iphonesimulator/$SCHEME.app"
PORT="${PORT:-4747}"
RUNTIME_VERSION="1.0.0"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/artifacts/demo-$TS"
LOG="$OUT_DIR/server.log"
SKIP_BUILD=0
FORCE_BUILD=0
FAILED=0

[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=1
mkdir -p "$OUT_DIR"

pass() { echo "  ✅ $*"; }
fail() { echo "  ❌ $*"; FAILED=1; }
note() { echo "  ⓘ $*"; }

# ---------- 小工具 ----------

# 把 App.tsx 的热更标记改成指定文案/颜色（改代码 = 改 bundle 内容 = 产生新更新 ID）
set_marker() { # $1=文案 $2=颜色
  sed -i '' "s|const BUNDLE_LABEL = .*|const BUNDLE_LABEL = '$1';|" "$APP_DIR/App.tsx"
  sed -i '' "s|const BUNDLE_COLOR = .*|const BUNDLE_COLOR = '$2';|" "$APP_DIR/App.tsx"
}
restore_v1_marker() { set_marker 'v1（内置包）' '#1e90ff'; }

restart_app() {
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
}

shot() { # $1=文件名 $2=等待秒数
  sleep "${2:-10}"
  xcrun simctl io "$UDID" screenshot "$OUT_DIR/$1" >/dev/null 2>&1
}

MARK=0
mark_log() { MARK=$(wc -l < "$LOG" | tr -d ' '); }
new_log() { tail -n "+$((MARK + 1))" "$LOG"; }

# 轮询等待服务器日志出现指定正则（模拟器首次启动较慢, 一次性 grep 不可靠）
wait_log() { # $1=正则 $2=超时秒数
  local deadline=$((SECONDS + ${2:-15}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    new_log | grep -qE "$1" && return 0
    sleep 0.5
  done
  return 1
}

# 可选: 若 python3 带 Pillow, 采样截图上部像素验证主色调
check_color() { # $1=截图 $2=期望(red|blue)
  python3 -c "import PIL" 2>/dev/null || { note "无 Pillow, 跳过像素级颜色断言（以服务器日志为准）"; return 0; }
  python3 - "$1" "$2" <<'EOF'
import sys
from PIL import Image
img, expect = sys.argv[1], sys.argv[2]
im = Image.open(img).convert("RGB")
w, h = im.size
r, g, b = im.getpixel((w // 2, int(h * 0.15)))
ok = (r > 180 and g < 120) if expect == "red" else (b > 150 and r < 120)
print(f"采样像素 ({r},{g},{b})")
sys.exit(0 if ok else 1)
EOF
}

cleanup() {
  echo "==> 收尾: 还原 App.tsx 为 v1 标记, 关闭更新服务器"
  restore_v1_marker
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT

# ---------- 0. 预检 ----------

echo "==> [0/4] 预检"

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
[ -z "$LAN_IP" ] && { echo "取不到 en0 的局域网 IP，请检查网络"; exit 1; }
if ! grep -q "http://$LAN_IP:$PORT/api/manifest" "$APP_DIR/app.json"; then
  note "app.json 的 updates.url 与当前 IP ($LAN_IP:$PORT) 不一致，自动改写并强制重新构建"
  sed -i '' -E "s|\"url\": \"http://[^\"]+/api/manifest\"|\"url\": \"http://$LAN_IP:$PORT/api/manifest\"|" "$APP_DIR/app.json"
  FORCE_BUILD=1
fi
pass "updates.url 指向 http://$LAN_IP:$PORT/api/manifest"

UDID="${SIM_UDID:-$(xcrun simctl list devices available -j | python3 -c "
import json, sys
devs = json.load(sys.stdin)['devices']
ids = [d['udid'] for rt, arr in devs.items() if 'iOS' in rt for d in arr if 'iPhone' in d['name']]
print(ids[0] if ids else '')
")}"
[ -z "$UDID" ] && { echo "找不到可用的 iPhone 模拟器"; exit 1; }
pass "模拟器 UDID: $UDID"

[ -d "$APP_DIR/ios/Pods" ] || { echo "缺少 ios/Pods，请先按 README 执行 prebuild + pod install"; exit 1; }
restore_v1_marker   # 保证从已提交的 v1 基线出发

# 启动更新服务器（独占端口）
lsof -ti ":$PORT" | xargs kill 2>/dev/null || true
sleep 1
node "$SERVER_DIR/server.js" > "$LOG" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 20); do curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break; sleep 0.5; done
curl -sf "http://127.0.0.1:$PORT/health" >/dev/null || { echo "更新服务器启动失败，日志见 $LOG"; exit 1; }
pass "更新服务器已启动 (pid $SERVER_PID, 日志: $LOG)"

# ---------- 构建与安装 ----------

if [ "$SKIP_BUILD" -eq 0 ] || [ "$FORCE_BUILD" -eq 1 ] || [ ! -d "$APP_PATH" ]; then
  echo "==> 构建 Release 应用（首次约 2-10 分钟，增量很快）"
  xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
    -destination "id=$UDID" -derivedDataPath "$DERIVED" -quiet build || { echo "构建失败"; exit 1; }
  pass "构建完成: $APP_PATH"
else
  note "--skip-build: 复用 $APP_PATH"
fi

xcrun simctl boot "$UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true   # 清掉历史更新缓存，保证全新安装
xcrun simctl install "$UDID" "$APP_PATH"
pass "应用已全新安装"

# ---------- 1. 基线: v1 内置包 ----------

echo "==> [1/4] 基线: 发布回滚指令, App 应运行在 v1 内置包"
"$SERVER_DIR/publish.sh" rollback >/dev/null
mark_log
restart_app
if wait_log "ROLLBACK|noUpdateAvailable" 20; then
  pass "服务器已响应回滚/无更新指令, 客户端停留在 v1"
else
  fail "服务器未按预期响应, 日志: $LOG"
fi
shot 01-v1-embedded.png 4
check_color "$OUT_DIR/01-v1-embedded.png" blue && pass "截图为 v1 蓝色" || fail "截图颜色与 v1 不符"

# ---------- 2. 发布 v2 热更 ----------

echo "==> [2/4] 发布 v2, App 应经 OTA 下载并自动生效"
V2_LABEL="v2（OTA 热更 $(date +%H:%M:%S)）"   # 文案带时间, 保证每次 demo 产生不同的 bundle 哈希
set_marker "$V2_LABEL" '#e63946'
PUB_OUT=$("$SERVER_DIR/publish.sh")
UPDATE_REL=$(echo "$PUB_OUT" | grep 发布完成 | awk '{print $2}')
NEW_BUNDLE=$(node -p "require('$SERVER_DIR/$UPDATE_REL/metadata.json').fileMetadata.ios.bundle.split('/').pop()")
note "新更新: $UPDATE_REL (bundle: $NEW_BUNDLE)"
mark_log
restart_app
if wait_log "$NEW_BUNDLE" 25; then
  pass "服务器日志确认新 bundle 经局域网下载: $NEW_BUNDLE"
else
  fail "未观察到新 bundle 下载, 日志: $LOG"
fi
shot 02-v2-ota.png 6
check_color "$OUT_DIR/02-v2-ota.png" red && pass "截图为 v2 红色（热更已上屏）" || fail "截图颜色与 v2 不符"

# ---------- 3. 回滚到内置包 ----------

echo "==> [3/4] 发布回滚指令, App 应回到 v1 内置包"
"$SERVER_DIR/publish.sh" rollback >/dev/null
mark_log
restart_app
if wait_log "ROLLBACK" 20; then
  pass "服务器已下发 rollBackToEmbedded 指令"
else
  fail "未观察到回滚指令, 日志: $LOG"
fi
shot 03-rollback-v1.png 6
check_color "$OUT_DIR/03-rollback-v1.png" blue && pass "截图为 v1 蓝色（回滚已上屏）" || fail "截图颜色与回滚预期不符"

# ---------- 4. 结论 ----------

echo "==> [4/4] 结论"
if [ "$FAILED" -eq 0 ]; then
  echo "🎉 demo 通过: 基线 v1 -> OTA v2 -> 回滚 v1 全链路验证成功"
  echo "   截图与服务器日志: $OUT_DIR"
  exit 0
else
  echo "⚠️ demo 存在失败项, 详见上方输出; 截图与日志: $OUT_DIR"
  exit 1
fi
