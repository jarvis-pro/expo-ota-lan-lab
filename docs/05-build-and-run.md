# 05 · 构建与运行

## 环境要求

- Node 24+（服务器 `.ts` 直跑依赖原生类型擦除）
- Xcode（本机实测 27.2）+ iOS 模拟器
- CocoaPods
- pnpm 9+（monorepo 包管理）

## 首次搭建

```bash
pnpm install                                # 安装两个 workspace 包的依赖（含 Maven 镜像补丁 postinstall）

# 生成 iOS 原生工程（CNG，ios/ 不入库）
pnpm --dir ota-demo exec expo prebuild --platform ios

# 安装 Pods（必须带 UTF-8 locale，原因见 06-排坑指南）
cd ota-demo/ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ../..
```

## 构建 Release 并装入模拟器

Updates 的完整 API 只在 Release 构建可用（开发构建永远跑 dev server 的最新代码）。

```bash
xcodebuild -workspace ota-demo/ios/otademo.xcworkspace -scheme otademo \
  -configuration Release -destination "id=<模拟器UDID>" \
  -derivedDataPath ota-demo/ios/.ios-build/derived-data/Release build

xcrun simctl boot <UDID>                     # 已启动则报错可忽略
xcrun simctl install <UDID> \
  ota-demo/ios/.ios-build/derived-data/Release/Build/Products/Release-iphonesimulator/otademo.app
xcrun simctl launch <UDID> com.demo.otalab
```

查看可用模拟器：`xcrun simctl list devices available`

## 日常热更循环

```bash
node server/server.ts        # 终端 1: 起更新服务器
# 改 ota-demo 的 JS 代码，然后:
node server/publish.ts      # 终端 2: 发布
# 模拟器里杀掉 App 重开（或点"手动检查更新"按钮）即可看到新包
```

**注意顺序**：先构建出原生包，再发布更新——否则发布的更新 commitTime 早于内置包，会被选择策略拒绝（见 [06](06-troubleshooting.md)）。

## 局域网 IP 变化时

`updates.url` 在构建期烧进原生包。本机 IP 变了（如换 Wi-Fi）：

```bash
# 改 ota-demo/app.json 的 updates.url，然后必须重新构建
```

## Android 扩展路径（本实验室未实测）

工程已预置 `android.package` 和 `usesCleartextTraffic`。装 Android SDK 后：

```bash
pnpm --dir ota-demo exec expo prebuild --platform android
pnpm --dir ota-demo exec expo run:android --variant release
```

publish.ts 的 `expo export` 会同时产出 android 产物，服务器按 `expo-platform` 请求头自动区分下发。

## 真机

- **Android**：同 Wi-Fi，adb 安装 release APK 即可，最简单。
- **iOS 真机**：需要 Apple 签名（免费账号 7 天有效），`updates.url` 用局域网 IP 无需改动。
