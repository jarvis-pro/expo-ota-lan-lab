# expo-ota-lan-lab

在局域网内验证 `expo-updates`（Expo SDK 58）自托管 OTA 热更的最小实验室：不依赖 EAS，自己的 Mac 就是更新服务器。

**完整知识点文档见 [docs/](docs/README.md)**（协议解析 / 架构 / 客户端配置 / 服务器实现 / 构建运行 / 排坑指南 / 验证记录）。

## 结构（pnpm monorepo）

```
package.json          根编排: pnpm server / pnpm publish / pnpm demo / pnpm typecheck
pnpm-workspace.yaml   workspace: ota-demo + server
.npmrc                node-linker=hoisted（RN/Metro/CocoaPods 兼容关键，见 docs/06）
demo.sh               可重复执行的端到端验证脚本（./demo.sh [--skip-build]）
docs/                 全部知识文档（按编号阅读）
scripts/              link-hoisted-modules.sh / patch-maven-mirror.sh（postinstall 自动执行）
                      make-ota-art.py（生成资源热更演示图 ota-art.png 的 v1/v2 变体）
ota-demo/             【workspace 包】Expo 应用（blank-typescript + expo-updates）
  app.json            updates.url 指向 http://192.168.0.105:4747/api/manifest, runtimeVersion "1.0.0"
  App.tsx             BUNDLE_LABEL / BUNDLE_COLOR 是内容热更标记；require 的 ota-art.png 是资源热更标记
  assets/ota-art.png  演示用资源：v1 绿色 / v2 橙色，热更时应随更新包变色
server/               【workspace 包】TypeScript 更新服务器（协议 v1, Node 24 直跑 .ts, 零运行时依赖）
  server.ts           GET /api/manifest（multipart/mixed）、GET /api/assets、GET /health
  publish.sh          一键发布：expo export → updates/<runtimeVersion>/<时间戳>/（最新时间戳生效）
  exportConfig.ts     生成 expoConfig.json（manifest 的 extra.expoClient）
  updates/            已发布的更新包
artifacts/            验证截图与日志
```

## 快速开始

```bash
pnpm install     # 安装全部依赖（postinstall 自动打 Maven 镜像补丁 + 建 node_modules 符号链接）

pnpm demo        # 一键端到端验证: 构建 -> v1 基线 -> 发布 v2 -> 热更断言 -> 回滚断言（约 3 分钟）
                 # 复用上次构建: ./demo.sh --skip-build（约 40 秒）

pnpm server      # 单独启动更新服务器
pnpm publish     # 改完 ota-demo 的 JS 后发布一个热更（回滚: ./server/publish.sh rollback）
pnpm typecheck   # 两个 workspace 包全量类型检查
```

## 手动分步操作

```bash
# 1. 启动更新服务器（如需改端口/IP，设 HOSTNAME 环境变量）
node server/server.ts

# 2. 构建 Release 版 App（Release 才有完整 Updates API；iOS 模拟器）
pnpm --dir ota-demo exec expo prebuild --platform ios
cd ota-demo/ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ../..
# 用 Xcode 或 xcodebuild 以 Release 配置构建并装入模拟器

# 3. 发布一个热更：改 App.tsx 里的 BUNDLE_LABEL / BUNDLE_COLOR，
#    需要演示资源热更再执行 python3 scripts/make-ota-art.py --variant v2，然后
./server/publish.sh

# 4. 冷启动 App（ON_LOAD 自动检查、下载，isUpdatePending 时自动 reload 生效）

# 回滚到内置包：
./server/publish.sh rollback
```

## 关键机制与坑（本次实测）

- **协议**：客户端 GET `updates.url`，带 `expo-platform` / `expo-runtime-version` / `expo-protocol-version: 1` / `expo-current-update-id` 等请求头；服务器返回 `multipart/mixed`（manifest 部分）。客户端已在最新更新时返回 `noUpdateAvailable` 指令。参考官方示例 `expo/custom-expo-updates-server`。
- **选择策略按 commitTime 过滤**：默认 selection policy 会拒绝比内置包更"旧"的更新——发布要在构建之后。
- **iOS 明文 HTTP**：`ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads = true`（仅实验室用，生产请上 HTTPS）。
- **CocoaPods 在 C locale 下崩溃**：`pod install` 必须带 `LANG=en_US.UTF-8`。
- **repo.reactnative.dev 极慢**：`scripts/patch-maven-mirror.sh` 已把 Maven 地址替换为 Maven Central，挂在 postinstall 上自动执行。
- **pnpm 布局**：依赖提升到根 node_modules，`scripts/link-hoisted-modules.sh` 用符号链接对齐原生工程的相对引用。
- **真机**：iOS 真机需签名；Android 已预置 `usesCleartextTraffic: true`，`pnpm --dir ota-demo exec expo run:android --variant release` 即可走同一服务器。

更多细节见 [docs/06-排坑指南](docs/06-troubleshooting.md)。

## 本次验证结果（iPhone 模拟器, iOS 27.0）

| 步骤 | 结果 |
|---|---|
| v1 内置包启动，检查到服务器上的 v1 | 因 commitTime 早于内置包被选择策略拒绝（符合预期） |
| 发布 v2 → 冷启动 | manifest → 下载 1.57MB bundle + 橙色资源图 → 自动 reload，界面变 v2，`运行来源: OTA 下载的更新`，资源路径指向更新目录 |
| 再次冷启动 | 服务器返回 `noUpdateAvailable`，不重复下载 |
| `./publish.sh rollback` → 冷启动 | 收到 `rollBackToEmbedded` 指令，回到 v1 内置包，资源图同步恢复绿色 |

资源热更的机制与注意事项见 [docs/08-资源文件热更](docs/08-asset-hot-update.md)。

详见 [docs/07-端到端验证](docs/07-verification.md)。
