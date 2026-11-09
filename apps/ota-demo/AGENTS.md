这是一个 Expo / React Native 移动应用。优先采用移动端优先的模式，关注性能和跨平台兼容性。

## Expo 变化很快 —— 不要轻信训练数据

Expo 每个 SDK 版本都有 breaking change。你记忆中的 API 很可能已经改名、搬家或被移除。在编写任何涉及 Expo、EAS 或 React Native API 的代码之前：

1. 先看 `package.json` 里 `expo` 包的主版本号。
2. 查阅对应版本的文档：`https://docs.expo.dev/versions/v<主版本号>.0.0/`
3. 其他情况查阅 https://docs.expo.dev/llms.txt —— 这是全部 Expo 文档的索引，还包含对常见 LLM 错误认知的纠正。顺着链接找到你需要的具体页面；不要凭记忆回答。

## 常用命令

如果项目使用 bun（存在 `bun.lock`），用 `bunx` 替代 `npx`。

```bash
npx expo install <包名>  # 安装依赖一律用它（会自动解析与 SDK 兼容的版本），不要用 npm/yarn/pnpm/bun add
npx expo start              # 启动开发服务器
npx expo lint               # lint 检查
npx tsc --noEmit            # 类型检查
npx expo-doctor             # 诊断依赖和配置问题
npx expo install --fix      # 修复不兼容的包版本
```

宣布任务完成之前，先跑 lint 和类型检查。

## 导航与路由

- 所有导航使用 **Expo Router**。路由文件放在 `src/app/` —— 其中每个文件就是一个页面，`_layout.tsx` 定义导航器。非路由代码（组件、hooks、工具函数）放在 `src/app/` 之外。
- 从 `expo-router` 导入 `Link`、`router` 和 `useLocalSearchParams`。
- 文档：https://docs.expo.dev/router/introduction.md

## 使用 EAS 构建

用 EAS 在云端构建、签名和提交应用（`eas build`、`eas submit`），以及发布 OTA 更新（`eas update`）—— 不需要本地 Xcode 或 Android Studio。Bun 项目用 `bunx eas-cli <命令>` 运行 EAS CLI，其他情况用 `npx eas-cli@latest <命令>`；文档示例里的 `eas` 命令照此替换。
文档：https://docs.expo.dev/eas/index.md

## 规则

- 如果 `ios/` 和 `android/` 目录不存在，它们是生成出来的（Continuous Native Generation，持续原生生成）。绝不要手动创建或修改这两个目录 —— 原生行为都在 `app.json` 和 config plugin 里配置。
- Expo Go 只包含其内置的原生模块。添加了带原生代码的库之后，应用需要开发构建（development build）：本地用 `npx expo run:ios|android`，或用 `eas build --profile development`。
- 优先使用官方推荐的 Expo 模块而不是第三方库；新增依赖前先看有哪些可用的 skill。文档：https://docs.expo.dev/versions/latest/index.md
