# 05 · 构建与运行

## 环境要求

- Node 24+（服务器 `.ts` 直跑依赖原生类型擦除）
- Xcode（本机实测 27.2）+ iOS 模拟器
- CocoaPods
- pnpm 9+（monorepo 包管理）
- Android 构建额外需要：JDK 17（`brew install --cask zulu@17`）、Android Studio（含 SDK Platform 36 + Build-Tools 36）

> **注意**：JDK 必须是 17。系统若只有 Android Studio 自带的 JDK（版本过高）会构建失败；也不要指望系统 `java`——macOS 默认没装。

## 首次搭建

```bash
pnpm install                                # 安装两个 workspace 包的依赖（含 Maven 镜像补丁 postinstall）

# 生成 iOS 原生工程（CNG，ios/ 不入库）
pnpm --dir apps/ota-demo exec expo prebuild --platform ios

# 安装 Pods（必须带 UTF-8 locale，原因见 06-排坑指南）
cd apps/ota-demo/ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install && cd ../..
```

## 构建 Release 并装入模拟器

Updates 的完整 API 只在 Release 构建可用（开发构建永远跑 dev server 的最新代码）。

```bash
xcodebuild -workspace apps/ota-demo/ios/otademo.xcworkspace -scheme otademo \
  -configuration Release -destination "id=<模拟器UDID>" \
  -derivedDataPath apps/ota-demo/ios/.ios-build/derived-data/Release build

xcrun simctl boot <UDID>                     # 已启动则报错可忽略
xcrun simctl install <UDID> \
  apps/ota-demo/ios/.ios-build/derived-data/Release/Build/Products/Release-iphonesimulator/otademo.app
xcrun simctl launch <UDID> com.demo.otalab
```

查看可用模拟器：`xcrun simctl list devices available`

## 日常热更循环

```bash
node apps/server/server.ts        # 终端 1: 起更新服务器
# 改 ota-demo 的 JS 代码，然后:
node apps/server/publish.ts      # 终端 2: 发布
# 模拟器里杀掉 App 重开（或点"手动检查更新"按钮）即可看到新包
```

**注意顺序**：先构建出原生包，再发布更新——否则发布的更新 commitTime 早于内置包，会被选择策略拒绝（见 [06](06-troubleshooting.md)）。

## 局域网 IP 变化时

`updates.url` 在构建期烧进原生包。本机 IP 变了（如换 Wi-Fi）：

```bash
# 改 apps/ota-demo/app.json 的 updates.url，然后必须重新构建
```

## Android 构建与真机运行（已实测：Galaxy S24 / Android 16）

### 环境变量（必需）

`pnpm -C apps/ota-demo android`（即 `expo run:android`）依赖 `JAVA_HOME` 和 `ANDROID_HOME`，终端里没配会直接报错。写进 `~/.zshrc` 一劳永逸：

```bash
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### USB 真机调试授权

数据线连接后 `adb devices` 必须显示 `device`（序列号旁）才算就绪：

- 列表为空 → 手机端「开发者选项 → USB 调试」没开（开启路径：设置 → 关于手机 → 软件信息 → 连点「编译编号」7 次，再回开发者选项开 USB 调试）
- 显示 `unauthorized` → 拔线重插，在手机上勾选「一律允许」并确认 RSA 授权弹窗；没弹窗就在开发者选项里点「撤销 USB 调试授权」再重插

### 构建命令

```bash
# 开发构建（自动生成 android/ 目录并装到设备，随后起 Metro）
pnpm -C apps/ota-demo android

# Release 构建（模板默认用 debug keystore 签名，可直接装机；首次约 4~5 分钟）
cd apps/ota-demo/android && ./gradlew assembleRelease && cd -
adb install -r apps/ota-demo/android/app/build/outputs/apk/release/app-release.apk
```

Updates 的完整 API 只在 Release 构建可用，验证 OTA 必须用 Release 包。

> **明文 HTTP**：OTA 服务器是 `http://` 局域网地址，Android 9+ 默认拦截明文流量。本工程通过 `expo-build-properties` 插件放行（SDK 58 起 `app.json` 的 `android.usesCleartextTraffic` 已失效），详见 [06](06-troubleshooting.md) 第 8 条。

## 真机

- **Android**：同 Wi-Fi，构建 release APK 后 `adb install -r` 即可（详见上文「Android 构建与真机运行」，已实测）。
- **iOS 真机**：需要 Apple 签名（免费账号 7 天有效），`updates.url` 用局域网 IP 无需改动。
