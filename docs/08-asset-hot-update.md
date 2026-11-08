# 08 · 资源文件热更

JS bundle 之外，`require` 引入的图片等资源文件同样走 OTA。本文解释资源热更的机制、本实验室的演示方式，以及和普通内容热更的差异。

## 机制：资源是怎么跟着更新走的

以 `ota-demo/assets/ota-art.png` 为例，App 里通过 `require('./assets/ota-art.png')` 引入：

1. **导出**：`expo export` 把被 bundle 引用的资源拷到 `dist/assets/<内容哈希>.png`，并在 `metadata.json` 的 `fileMetadata.<platform>.assets` 里登记 `{path, ext}`。
2. **manifest**：服务器（`server.ts` 的 `getAssetMetadataAsync`）把每个资源换算成协议 manifest 里的一项：`key`（md5，客户端去重缓存用）、`hash`（sha256）、`contentType`、`url`（指向 `GET /api/assets`）。
3. **下载**：客户端拿到 manifest 后，把本地缓存里**没有这个 key** 的资源逐个从 `/api/assets` 拉下来，存进该更新的私有目录。bundle 和资源的下载日志在服务器侧都能看到（`[assets] -> ...`）。
4. **解析**：重启生效后，新 bundle 里的 `require` 由 expo-updates 的资源解析器重定向到更新目录里的新文件。`Image.resolveAssetSource(otaArt).uri` 可以直接看到这一点：内置包时指向 App bundle 内，OTA 后指向设备上的更新目录。

与 bundle 相同的是**选择策略、签名、multipart 协议完全一样**——资源只是 manifest 里 `assets[]` 数组的条目，没有第二条通道。

## 关键差异：首次新增资源必须重建原生包

Release 构建时，"Bundle React Native code and images" 阶段会把当时被引用的资源打进 `.app` 并写入内嵌 manifest。因此：

- **新增**一个 `require` 的资源：必须重新构建原生包，否则内置 bundle 运行时找不到这个资源。
- **修改**已有资源的内容：纯 OTA 即可。资源哈希变化 → 新 key → 客户端重新下载；内容没变则复用缓存，不重复下载。

回滚到内置包时，资源也一起回到内置版本（`rollBackToEmbedded` 指令重新指向内嵌 manifest）。

## 不是"资源文件"的情况

`require('./xxx.json')`、内联 SVG 字符串等会被 Metro **内联进 JS bundle**，不会出现在 manifest 的 `assets[]` 里——它们随 bundle 一起更新，没有单独的资源下载行为。

## 本实验室的演示方式

- `scripts/make-ota-art.py`：用 Pillow 生成 `ota-art.png` 的两个变体——v1 绿色 "ASSET V1"（git 提交版，进内置包），v2 橙色 "ASSET V2"（发布热更前临时生成）。故意与背景蓝/红不同色，截图可单独断言。
- `App.tsx`：把这张图渲染在界面上，并显示 `Image.resolveAssetSource` 解析出的实际加载路径。
- `demo.sh` 第 2 步：发布前切到 v2 资源 → 从 `metadata.json` 解析出资源文件名 → 断言服务器日志里该资源经局域网下载 → 全图扫描截图里出现大面积橙色；第 3 步回滚后断言回到绿色。

## 实测结果（iPhone 模拟器, iOS 27.0）

| 步骤 | bundle | 资源 |
|---|---|---|
| v1 基线 | 内置 | 绿色资源块，路径指向 App bundle 内 |
| OTA v2 | 下载 `index-*.hbc`（约 1.6MB） | 下载约 6KB 的橙色 png，界面变橙色资源块，路径指向更新目录 |
| 回滚 | 收到 `rollBackToEmbedded` | 资源随回滚恢复为内置绿色版，不再产生下载 |

断言输出见 `artifacts/demo-*/` 最新一次运行。
