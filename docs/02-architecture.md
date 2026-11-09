# 02 · 实验室架构

## 组件构成

```
expo-ota-lan-lab/
├── ota-demo/            # 【客户端】Expo SDK 58 应用 (workspace 包: ota-demo)
│   ├── app.json         #   updates.url / runtimeVersion / ATS 等关键配置
│   ├── App.tsx          #   演示界面: 版本标记 + useUpdates 状态面板 + 手动操作按钮
│   └── ios/             #   prebuild 生成的原生工程 (gitignore, CNG)
├── server/              # 【更新服务器】TypeScript, Node 24 直跑 (workspace 包: expo-ota-lan-server)
│   ├── server.ts        #   协议 v1 实现: /api/manifest + /api/assets + /health
│   ├── publish.ts       #   一键发布脚本 (expo export → 归档 → expo-config.json)
│   ├── mime.ts          #   资源 Content-Type 映射
│   └── updates/         #   更新包仓库 (gitignore)
│       └── <runtimeVersion>/<发布时间戳>/
│           ├── metadata.json     # expo export 产物: bundle/资源清单
│           ├── expo-config.json   # publish.ts 生成
│           ├── _expo/static/...  # bundle 与资源文件
│           └── rollback          # (可选) 存在即表示"回滚到内置包"
├── scripts/             # 辅助脚本 (如 Maven 镜像补丁)
├── docs/                # 本文档目录
├── artifacts/           # 验证产物: 截图 + 服务器日志 (gitignore)
└── demo.sh              # 一键端到端验证脚本
```

## 一次热更的完整数据流

```
① 改代码                ota-demo/App.tsx (改文案/颜色)
② 发布                  server/publish.ts
                          ├─ pnpm --dir ota-demo exec expo export   → ota-demo/dist/
                          ├─ cp → server/updates/1.0.0/<时间戳>/
                          └─ @expo/config getConfig() → expo-config.json
③ App 启动/手动检查      expo-updates GET http://192.168.0.105:4747/api/manifest
④ 服务器响应             取 updates/1.0.0/ 下时间戳最新的目录, 组装 multipart manifest
⑤ 客户端下载             按 manifest 中的 url 逐个 GET /api/assets
⑥ 生效                  下载完成 → isUpdatePending → App 自动 reloadAsync → 新界面
```

## 设计决策与理由

| 决策 | 理由 |
|---|---|
| 服务器零运行时依赖（纯 `node:*` 模块） | 实验室内网可离线跑；Node 24 原生类型擦除，`.ts` 直跑无需编译 |
| 按 `<runtimeVersion>/<时间戳>` 归档发布 | 与官方示例一致；天然支持多 runtimeVersion 并存、按时间取最新 |
| 更新 ID = metadata.json 的哈希 | 内容寻址，同内容同 ID，客户端可安全去重 |
| commitTime 取文件的 birthtime | 与官方示例一致；选择策略依赖它判断新旧 |
| 回滚 = 目录里放 `rollback` 空文件 | 官方示例的约定，服务器转成 `rollBackToEmbedded` 指令 |
| 端口 4747 / IP 写死在 app.json | 局域网实验室从简；demo.sh 会在 IP 变化时自动改写并强制重建 |

## 与生产级方案的差距

本实验室聚焦"验证协议机制"，以下能力刻意从简：

- **无代码签名**：生产应配置 `updates.codeSigningCertificate` 防篡改。
- **无 HTTPS**：iOS 端靠 `NSAllowsArbitraryLoads` 放行明文 HTTP，仅限实验。
- **无灰度/分渠道**：EAS Update 的 channel/branch/rollout 需自行在 manifest 接口实现（可用 `expo-extra-params` 请求头携带客户端维度）。
- **无持久化状态**：服务器无数据库，"最新时间戳即最新发布"；断电/误删 updates/ 即回到内置包。
