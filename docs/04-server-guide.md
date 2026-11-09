# 04 · 更新服务器实现

`server/` 是一个零运行时依赖的 TypeScript 实现（Node 24 原生类型擦除，`node server.ts` 直跑）。协议细节见 [01](01-protocol.md)，本文件解读代码本身。

## server.ts 结构

```
类型定义            ExpoExportMetadata / PlatformFileMetadata / AssetMetadata / UpdateManifest / MultipartPart
工具函数            getBase64URLEncoding / convertSHA256HashToUUID
                    getLatestUpdateBundlePathForRuntimeVersionAsync   取 updates/<rv>/ 下时间戳最新目录
                    getMetadataAsync        读 metadata.json → { 内容, commitTime, 更新ID }
                    getExpoConfigAsync      读 expoConfig.json
                    getAssetMetadataAsync   算 hash(sha256 base64url) 和 key(md5 hex)，拼资源 URL
multipart 响应      sendMultipart / sendNoUpdateAvailable / sendRollback / sendJson
接口                handleManifest          GET /api/manifest
                    handleAssets            GET /api/assets
入口                http.createServer       路由 + 请求日志 + 统一错误处理
```

## handleManifest 的决策树

```
请求带 expo-platform / expo-runtime-version ?
  ├─ 否 → 400
  ├─ 带 expo-expect-signature → 400 (本实验室不签名)
  ├─ updates/<runtimeVersion>/ 不存在 → 404
  ├─ 最新发布目录含 rollback 文件 →
  │     客户端当前就在内置包? → noUpdateAvailable
  │     否则 → rollBackToEmbedded 指令
  └─ 正常发布 →
        客户端 currentUpdateId == 最新更新 ID? → noUpdateAvailable
        否则 → manifest (multipart, 含 launchAsset + assets + extra.expoClient)
```

## 几个容易写错的点

- **资源 URL 必须是绝对地址**：用 `HOSTNAME` 环境变量拼（默认 `http://192.168.0.105:4747`），客户端按此 URL 回源下载；只写路径不写 host 会导致客户端请求失败。
- **响应必须是 multipart/mixed**：协议 v1 的客户端按 form-data 分段解析（manifest 段 + extensions 段），不能只回一个 JSON。server.ts 里手工拼 boundary，不依赖任何库。
- **`cache-control: private, max-age=0`**：防止中间缓存把旧 manifest 发给客户端。
- **目录穿越防护**：`/api/assets` 的 `asset` 参数是客户端回传的路径，必须 `path.resolve` 后校验仍在 `updates/` 内。
- **commitTime 来自文件 birthtime**：`cp` 拷贝会刷新 birthtime，所以每次 `publish.sh` 发布天然就是"更新"的；如果改用 `mv` 或保留时间戳的参数，注意这个语义会变。

## publish.sh 发布流程

```bash
./server/publish.sh            # 正常发布
./server/publish.sh rollback   # 发布"回滚到内置包"指令
```

正常发布做了三件事：

1. `pnpm --dir ota-demo exec expo export` → 产出 `ota-demo/dist/`（metadata.json + bundle + 资源）；
2. 拷贝到 `server/updates/<runtimeVersion>/<时间戳>/`（时间戳取自 `Date.now()`，目录名数字排序即发布时间排序）；
3. `node server/export-config.ts ota-demo > expoConfig.json` —— 用 `@expo/config` 展开 App 配置，客户端把它放在 `manifest.extra.expoClient` 里使用。

## export-config.ts

等价于 `npx expo config --type public`，但以编程方式调用 `@expo/config` 的 `getConfig()`（从 App 目录解析依赖，monorepo 下也能找到根目录的 node_modules），避免解析 CLI stdout 里混入的日志行。

## mime.ts

仅覆盖 expo export 常见产物的 Content-Type 映射（hbc/bundle → `application/javascript`，图片、字体等）。不认识的类型回退 `application/octet-stream`。

## 本地调试

```bash
node server/server.ts                     # 启动
curl http://127.0.0.1:4747/health         # 健康检查
# 模拟客户端检查更新:
curl -H 'expo-protocol-version: 1' -H 'expo-platform: ios' -H 'expo-runtime-version: 1.0.0' \
     http://127.0.0.1:4747/api/manifest
```
