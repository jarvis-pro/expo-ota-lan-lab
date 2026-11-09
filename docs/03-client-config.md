# 03 · 客户端配置与 Updates API

适用版本：Expo SDK 58 / expo-updates ~58.0.x（[官方文档](https://docs.expo.dev/versions/v58.0.0/sdk/updates/)）。

## app.json 关键配置

```json
{
  "expo": {
    "runtimeVersion": "1.0.0",
    "updates": {
      "enabled": true,
      "url": "http://192.168.0.105:4747/api/manifest",
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0
    },
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": { "NSAllowsArbitraryLoads": true }
      }
    }
  }
}
```

| 配置项 | 作用 | 说明 |
|---|---|---|
| `runtimeVersion` | 更新的兼容边界 | 服务器只下发与该值完全匹配的更新。**改了原生代码/升级 SDK 必须改它**。除字符串外还支持策略写法：`{ "policy": "appVersion" }`、`"nativeVersion"`、`"fingerprint"` |
| `updates.url` | 更新服务器地址 | 指向自建服务器即脱离 EAS；**该值在构建时烧进原生包**，改了必须重新构建 |
| `updates.enabled` | 总开关 | false 时永远跑内置包 |
| `updates.checkAutomatically` | 自动检查时机 | `ON_LOAD`（默认，每次启动）/ `WIFI_ONLY` / `ON_ERROR_RECOVERY` / `NEVER`（只走手动 API） |
| `updates.fallbackToCacheTimeout` | 启动等待毫秒数 | 0 = 立即用本地缓存启动、后台下载，下次启动生效；调大可让"启动即换新包"，代价是启动变慢 |
| `updates.codeSigningCertificate` | 代码签名 | 本实验室未配置；生产建议开启（见 [01](01-protocol.md)） |

### 明文 HTTP（仅实验室，生产改用 HTTPS）

- **iOS**：ATS 默认禁止明文 HTTP。`ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads: true` 经 prebuild 写入 Info.plist（本工程已配好）。
- **Android**：Android 9+ 默认禁止明文 HTTP。SDK 58 起 `app.json` 的 `android.usesCleartextTraffic` 已被移除、写了不生效，需用 `expo-build-properties` 插件：`["expo-build-properties", { "android": { "usesCleartextTraffic": true } }]`（本工程已配好，详见 [06](06-troubleshooting.md) 第 8 条）。

## Updates API 速查

```ts
import * as Updates from 'expo-updates';
```

**只能在 Release 构建中使用完整 API**；开发构建/Expo Go 里多数方法会直接 reject。

| API | 用途 |
|---|---|
| `Updates.useUpdates()` | Hook：拿到 `currentlyRunning`（当前更新的 id/来源/runtimeVersion）、`isUpdateAvailable`、`isUpdatePending`、`isChecking`、`isDownloading`、`downloadProgress`、错误等全部状态 |
| `Updates.checkForUpdateAsync()` | 手动检查；返回 `isAvailable` / `isRollBackToEmbedded` / `reason` |
| `Updates.fetchUpdateAsync()` | 手动下载；完成后 `isUpdatePending` 变 true |
| `Updates.reloadAsync()` | 立即重启并切换到已下载的更新（不调用则下次冷启动生效） |
| `Updates.readLogEntriesAsync()` | 读客户端日志，排查 `updateRejectedBySelectionPolicy` 等原因 |

本实验室 App 的自动生效逻辑（`apps/ota-demo/App.tsx`）：

```tsx
const { isUpdatePending } = Updates.useUpdates();
useEffect(() => {
  if (isUpdatePending) Updates.reloadAsync();   // 下载完成立即重启生效
}, [isUpdatePending]);
```

## 选择策略（selection policy）

客户端默认使用"过滤器感知"策略决定一个更新能否启动，关键规则：

1. **runtimeVersion 必须匹配**，否则直接忽略；
2. **commitTime 不能早于内置包**——这是防降级机制。先 export 再构建 App 时，服务器上的更新会比内置包"旧"，会被拒绝（客户端日志原因：`updateRejectedBySelectionPolicy`）。**正确顺序：先构建出包，再发布更新**；
3. 之前下载但启动失败过的更新会被拉黑，不再启动（防砖）。

## 调试技巧

- App 里看状态面板：运行来源（内置/OTA）、updateId、上次检查时间。
- 服务器日志看链路：`[manifest] -> update ...` / `noUpdateAvailable` / `ROLLBACK` + `[assets] -> xxx.hbc`。
- iOS 客户端日志：`Updates.readLogEntriesAsync()`，或直接看 Xcode 控制台里 `EXUpdates` 前缀的输出。
