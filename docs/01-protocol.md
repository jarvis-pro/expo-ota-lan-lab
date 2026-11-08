# 01 · expo-updates 协议解析

本实验室的更新服务器实现的是 **expo-updates 协议 v1**。协议本身不绑定 EAS——任何按规范响应的 HTTP 服务器都可以作为更新源，这正是"自托管 / 局域网热更"的原理。本文件内容以官方示例 [expo/custom-expo-updates-server](https://github.com/expo/custom-expo-updates-server) 和实测抓包（服务器日志）为准。

## 交互总览

```
App 启动（或手动调用 checkForUpdateAsync）
  │
  ├─ 1. GET {updates.url}            带 expo-* 请求头
  │      ◄── 200 multipart/mixed     manifest 部分 = 更新描述
  │        或 directive 部分          noUpdateAvailable / rollBackToEmbedded
  │
  ├─ 2. GET /api/assets?...          按 manifest 中的 url 逐个下载
  │      ◄── bundle / 图片 / 字体等资源文件
  │
  └─ 3. 全部下载完成 → 标记为"待启动更新" → 下次启动（或 reloadAsync）生效
```

## 第 1 步：manifest 请求

客户端 GET `app.json` 里配置的 `updates.url`，携带的关键请求头：

| 请求头 | 含义 | 本实验室的值 |
|---|---|---|
| `expo-protocol-version` | 协议版本 | `1`（v1 才支持指令式响应） |
| `expo-platform` | 平台 | `ios` / `android` |
| `expo-runtime-version` | 运行时版本 | `1.0.0`（见 [03](03-client-config.md)） |
| `expo-current-update-id` | 客户端当前运行的更新 ID | 用于判断"已是最新" |
| `expo-embedded-update-id` | 内置包的更新 ID | 回滚指令需要它 |
| `expo-expect-signature` | 要求代码签名 | 配置了 codeSigning 才会带（本实验室未启用） |

实测日志样本：

```
[req] GET /api/manifest platform=ios runtime=1.0.0
```

## 第 1 步的响应：三种情况

响应统一为 `multipart/mixed`，并带回响应头 `expo-protocol-version: 1`、`expo-sfv-version: 0`、`cache-control: private, max-age=0`。

**① 有新更新** —— body 含 `manifest` 部分（`content-type: application/json`）：

```json
{
  "id": "b3632f65-d68f-0308-8f3e-ae556a90e889",   // metadata.json 的 sha256 截断成 UUID
  "createdAt": "2026-11-08T10:31:37.266Z",        // commitTime，选择策略据此过滤
  "runtimeVersion": "1.0.0",
  "launchAsset": {                                 // JS bundle
    "hash": "uPlY9RlS3k04F4Vp-EZLp94J9mG_fmLwlcuVKrnY59Y",  // sha256 的 base64url
    "key": "7e56644df4a196037447e6364c677f1a",              // md5 hex，客户端缓存键
    "fileExtension": ".bundle",
    "contentType": "application/javascript",
    "url": "http://192.168.0.105:4747/api/assets?asset=..."
  },
  "assets": [],                                    // 图片/字体等其他资源，结构同上
  "metadata": {},
  "extra": { "expoClient": { /* 发布时的 app.json 展开结果 */ } }
}
```

**② 没有可用更新** —— body 含 `directive` 部分：

```json
{ "type": "noUpdateAvailable" }
```

触发条件：客户端的 `expo-current-update-id` 与服务器最新更新 ID 相同。此时不重复下载。

**③ 回滚到内置包** —— body 含 `directive` 部分：

```json
{ "type": "rollBackToEmbedded", "parameters": { "commitTime": "..." } }
```

本实验室用"最新发布目录中存在 `rollback` 空文件"表示回滚发布（与官方示例一致）。

## 第 2 步：资源下载

客户端拿到 manifest 后，逐个 GET `launchAsset.url` 和 `assets[].url`。URL 由服务器生成，本实验室格式：

```
GET /api/assets?asset=<相对 updates/ 的路径>&runtimeVersion=1.0.0&platform=ios
```

实测日志样本：

```
[req] GET /api/assets platform=ios runtime=1.0.0
[assets]  -> index-a703798560c001e3177f1526178b6462.hbc (1574732 bytes, application/javascript)
```

## 第 3 步：生效时机

- 默认 `checkAutomatically: ON_LOAD`：启动时检查、后台下载，**下次启动**生效。
- JS 里可以在 `isUpdatePending`（下载完成）时调 `Updates.reloadAsync()` 立即生效——本实验室的 App 就是这么做的（见 `ota-demo/App.tsx`）。

## 关键细节

- **更新 ID 的唯一性**：ID = 发布产物 `metadata.json` 的 sha256。两次发布内容完全相同 → ID 相同 → 客户端视为同一更新。因此 demo 脚本每次发布都在界面文案里带时间戳，保证 ID 唯一。
- **runtimeVersion 是安全边界**：只有 runtimeVersion 完全匹配的更新才会下发。升级 SDK、增删原生模块后必须改 runtimeVersion 并重新出原生包。
- **选择策略过滤**：默认策略会拒绝 commitTime 早于内置包的更新（详见 [06-排坑指南](06-troubleshooting.md)）。
- **代码签名**：协议支持 `expo-signature`（RSA-SHA256）签名校验，本实验室未启用；生产环境建议开启，参考官方示例仓库的 `code-signing-keys/`。
