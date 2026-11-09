# expo-ota-lan-lab 文档

本目录按主题归类了理解和使用本实验室所需的全部知识点。建议按编号顺序阅读。

| 文档 | 内容 |
|---|---|
| [01-expo-updates 协议解析](01-protocol.md) | 协议 v1 的完整交互：请求头、multipart manifest、指令、资源下载 |
| [02-实验室架构](02-architecture.md) | 组件构成、目录约定、一次热更的完整数据流 |
| [03-客户端配置与 API](03-client-config.md) | app.json 配置项、Updates API 速查、选择策略 |
| [04-更新服务器实现](04-server-guide.md) | server.ts 代码解读、publish.ts 发布流程 |
| [05-构建与运行](05-build-and-run.md) | iOS Release 构建、模拟器运行、Android 扩展路径 |
| [06-排坑指南](06-troubleshooting.md) | 本次实测踩过的坑与解决办法 |
| [07-端到端验证](07-verification.md) | demo.sh 的设计、断言方式、实测结果 |
| [08-资源文件热更](08-asset-hot-update.md) | require 引入的图片等资源如何随更新分发、下载与解析，与内容热更的差异 |

## 一页速览

```
开发者 Mac                                    iOS 模拟器 / 真机
┌──────────────────────────────┐             ┌─────────────────────┐
│ server/server.ts  ( :4747 )  │ ◄── GET /api/manifest ── expo-updates 客户端
│   updates/1.0.0/<ts>/        │ ── multipart manifest ─► (随 App 启动检查)
│   publish.ts (expo export)   │ ◄── GET /api/assets ──── 按 manifest 逐个下载
└──────────────────────────────┘ ── bundle/assets ──────► 下载完重启生效
```

- 客户端：`ota-demo/`（Expo SDK 58 + expo-updates，`app.json` 指向局域网服务器）
- 服务器：`server/`（TypeScript，Node 24 直跑，零运行时依赖）
- 验证：`./demo.sh` 一键端到端（基线 → 热更 → 回滚）
