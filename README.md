# expo-ota-lan-lab

在局域网内验证 `expo-updates`（Expo SDK 58）自托管 OTA 热更的最小实验室：不依赖 EAS，自己的 Mac 就是更新服务器。

## 结构

```
demo.sh            可重复执行的端到端验证脚本（./demo.sh [--skip-build]）
ota-demo/          Expo 应用（blank-typescript + expo-updates）
  app.json         updates.url 指向 http://192.168.0.105:4747/api/manifest, runtimeVersion "1.0.0"
  App.tsx          BUNDLE_LABEL / BUNDLE_COLOR 是热更可视化标记；含 useUpdates 状态面板和手动检查/下载/重启按钮
server/            零依赖 Node 更新服务器（expo-updates 协议 v1）
  server.js        GET /api/manifest（multipart/mixed）、GET /api/assets、GET /health
  publish.sh       一键发布：expo export → updates/<runtimeVersion>/<时间戳>/（最新时间戳生效）
  exportConfig.js  生成 expoConfig.json（manifest 的 extra.expoClient）
  updates/         已发布的更新包
artifacts/         验证截图
```

## 快速开始

### 一键端到端 demo（推荐）

```bash
./demo.sh                # 全流程: 预检 -> 构建 -> 全新安装 -> v1 基线 -> 发布 v2 -> 验证热更 -> 回滚 -> 断言
./demo.sh --skip-build   # 复用上次构建, 约 40 秒跑完
```

断言方式：服务器日志（manifest 响应 / 新 bundle 下载 / 回滚指令）+ 截图主色采样（本机 python3 有 Pillow 时自动启用像素级断言）。每轮的截图和服务器日志保存在 `artifacts/demo-<时间戳>/`。脚本会自动检测 app.json 的 updates.url 是否与当前局域网 IP 一致（不一致则改写并强制重新构建）。

### 手动分步操作

```bash
# 1. 启动更新服务器（如需改端口/IP，设 HOSTNAME 环境变量）
node server/server.js

# 2. 构建 Release 版 App（Release 才有完整 Updates API；iOS 模拟器）
cd ota-demo && npm install
npx expo prebuild --platform ios
cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ..
# 用 Xcode 或 xcodebuild 以 Release 配置构建并装入模拟器

# 3. 发布一个热更：改 App.tsx 里的 BUNDLE_LABEL / BUNDLE_COLOR，然后
./server/publish.sh

# 4. 冷启动 App（ON_LOAD 自动检查、下载，isUpdatePending 时自动 reload 生效）

# 回滚到内置包：
./server/publish.sh rollback
```

## 关键机制与坑（本次实测）

- **协议**：客户端 GET `updates.url`，带 `expo-platform` / `expo-runtime-version` / `expo-protocol-version: 1` / `expo-current-update-id` 等请求头；服务器返回 `multipart/mixed`（manifest 部分）。客户端已在最新更新时返回 `noUpdateAvailable` 指令。参考官方示例 `expo/custom-expo-updates-server`。
- **选择策略按 commitTime 过滤**：默认 selection policy 会拒绝比内置包更"旧"的更新。先 export v1 再构建 App，v1 会被拒（`updateRejectedBySelectionPolicy`）——发布要在构建之后。
- **iOS 明文 HTTP**：`ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads = true`（仅实验室用，生产请上 HTTPS）。
- **CocoaPods 在 C locale 下崩溃**（`Unicode Normalization not appropriate for ASCII-8BIT`）：`pod install` 必须带 `LANG=en_US.UTF-8`。
- **repo.reactnative.dev 极慢**：本机环境下 hermes-engine 预编译包几乎下不动，已把 `node_modules/react-native` 内的 Maven 地址改为 Maven Central（`repo1.maven.org/maven2`）。`npm install` 重装后需重打：

  ```bash
  grep -rl "https://repo.reactnative.dev/maven2" node_modules/react-native/ --include="*.rb" --include="*.podspec" \
    | xargs sed -i '' 's|https://repo.reactnative.dev/maven2|https://repo1.maven.org/maven2|g'
  ```
- **真机**：iOS 真机需签名；Android 已预置 `usesCleartextTraffic: true`，`npx expo run:android --variant release` 即可走同一服务器。

## 本次验证结果（iPhone 17 模拟器, iOS 27.0）

| 步骤 | 结果 |
|---|---|
| v1 内置包启动，检查到服务器上的 v1 | 因 commitTime 早于内置包被选择策略拒绝（符合预期） |
| 发布 v2 → 冷启动 | manifest → 下载 1.57MB bundle → 自动 reload，界面变 v2，`运行来源: OTA 下载的更新` |
| 再次冷启动 | 服务器返回 `noUpdateAvailable`，不重复下载 |
| `./publish.sh rollback` → 冷启动 | 收到 `rollBackToEmbedded` 指令，回到 v1 内置包 |
