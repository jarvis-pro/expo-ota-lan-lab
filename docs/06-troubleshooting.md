# 06 · 排坑指南

全部是本实验室 2026-11-08 在 macOS（Xcode 27.2 / iOS 27 模拟器 / SDK 58）上实测踩过的坑。

## 1. 发布的更新被客户端无视（commitTime 坑）

**现象**：App 启动后服务器返回了 manifest，但客户端不下载、不报错。

**原因**：默认选择策略拒绝 commitTime 早于内置包的更新（防降级）。我们先 `expo export` 发布了 v1，之后构建的原生包内置 bundle 时间更晚，于是 v1 被判"过期"。

**解法**：永远"先出包、后发布"。用 `Updates.readLogEntriesAsync()` 可看到 `updateRejectedBySelectionPolicy`。

## 2. CocoaPods 在 C locale 下崩溃

**现象**：`pod install` 报 `Unicode Normalization not appropriate for ASCII-8BIT (Encoding::CompatibilityError)`。

**原因**：shell 环境 `LANG` 为空时，Ruby 的 filesystem encoding 是 US-ASCII，CocoaPods 处理路径时崩溃。

**解法**：

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
```

## 3. repo.reactnative.dev 下载极慢（hermes-engine 卡住）

**现象**：`pod install` 卡在 hermes-engine，30 MB 的包速度只有几百 B/s，最后 `Connection reset by peer`。

**原因**：RN 预编译产物默认从 `https://repo.reactnative.dev/maven2` 下载，该域名在本网络环境几乎不可用。

**解法**：把下载源替换为 Maven Central（实测 30 MB 约 3.5 秒）。本仓库已固化为 postinstall 补丁脚本 `scripts/patch-maven-mirror.ts`（pnpm install 后自动执行），手动执行：

```bash
node scripts/patch-maven-mirror.ts
```

原理：递归扫描 node_modules 下的 `.rb` / `.podspec` 真实文件（跳过符号链接，pnpm 的真实内容在 `.pnpm` 目录里），把 `https://repo.reactnative.dev/maven2` 替换为 `https://repo1.maven.org/maven2`。

## 4. iOS 明文 HTTP 被 ATS 拦截

**现象**：App 检查更新直接失败，服务器收不到请求。

**解法**：`app.json` 加 `ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads: true`（本工程已配），改完需重新 prebuild/构建。

## 5. 开发构建里 Updates API 全部 reject

**现象**：`checkForUpdateAsync` 报 `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`。

**原因**：这是设计如此——开发构建永远加载 dev server 的代码。**验证热更必须用 Release 构建**（`--configuration Release`）。

## 6. 重复发布同内容，客户端不更新

**现象**：改了代码又改回去再发布，客户端无反应。

**原因**：更新 ID = metadata.json 内容哈希；内容相同则 ID 相同，客户端的 `expo-current-update-id` 匹配后服务器返回 `noUpdateAvailable`。验证时可在 v2 文案里嵌入时间戳保证每次发布 ID 唯一。

## 7. pnpm monorepo 下 React Native 找不到模块

**解法**：根目录 `.npmrc` 配置 `node-linker=hoisted`，让 node_modules 退化为 npm 风格的扁平结构，Metro / CocoaPods / autolinking 都不需要特殊配置。这是目前 RN 生态对 pnpm 最省心的用法。
