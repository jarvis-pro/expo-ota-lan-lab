// 一键发布 OTA 更新到局域网服务器 (跨平台 Node/TS 版)
// 用法: node publish.ts [rollback]
//   无参数: 在 ../ota-demo 执行 expo export 并发布为新更新
//   rollback: 发布一条"回滚到内置包"指令
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const SERVER_DIR = import.meta.dirname;
const APP_DIR = path.resolve(SERVER_DIR, "../ota-demo"); // apps/ota-demo

/** 运行外部命令; 任何一步失败立即抛错, 以非零码退出 */
function run(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    // Windows 上 pnpm 是 .cmd 批处理, 必须经由 shell 启动
    shell: process.platform === "win32",
  });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} 退出码 ${r.status}`);
}

/** 从 App 的 app.json 读取 runtimeVersion */
function readRuntimeVersion(): string {
  const appJson = JSON.parse(
    fs.readFileSync(path.join(APP_DIR, "app.json"), "utf8"),
  );
  const rv = appJson.expo?.runtimeVersion;
  if (typeof rv !== "string") {
    throw new Error("runtimeVersion 必须是字符串, 当前策略不支持自动展开");
  }
  return rv;
}

/** expo export 导出更新包到 apps/ota-demo/dist/ */
function exportUpdate() {
  console.log("==> 导出更新包 (expo export, 仅原生平台)");
  // 显式限定 ios/android: app.json 里的 web 配置只用于开发环境快速预览,
  // 不限制平台时 expo export 会把 web bundle 也打进更新包
  run("pnpm", ["exec", "expo", "export", "--platform", "ios", "--platform", "android"], APP_DIR);
}

/** 把 dist/ 拷贝进目标更新目录 */
function copyDist(target: string) {
  fs.cpSync(path.join(APP_DIR, "dist"), target, { recursive: true });
}

/** 展开 App 的 public config, 写入 expo-config.json (manifest 的 extra.expoClient) */
function writeExpoConfig(target: string) {
  // 从目标项目视角解析 @expo/config: 保证用 App 自己 SDK 版本的工具链展开配置,
  // 同时 server 包保持零依赖, 不直接 import 这棵依赖树
  const require = createRequire(import.meta.url);
  const { getConfig } = require(
    require.resolve("@expo/config", { paths: [APP_DIR] }),
  );
  const { exp } = getConfig(APP_DIR, {
    skipSDKVersionRequirement: true, // SDK 49+ 的 app.json 已无 sdkVersion 字段
    isPublicConfig: true, // 只保留可安全下发的公共字段
  });
  fs.writeFileSync(path.join(target, "expo-config.json"), JSON.stringify(exp));
}

/** 发布一条回滚指令 (存在 rollback 文件即表示回滚到内置包) */
function publishRollback(target: string, relPath: string) {
  fs.writeFileSync(path.join(target, "rollback"), "");
  console.log(`已发布回滚指令: ${relPath}/rollback`);
}

/** 正常发布: 导出 -> 拷贝 -> 生成 expo-config.json */
function publishUpdate(target: string, relPath: string) {
  exportUpdate();
  console.log(`==> 拷贝到 ${relPath}`);
  copyDist(target);
  console.log("==> 生成 expo-config.json");
  writeExpoConfig(target);
  console.log(`发布完成: ${relPath}`);
}

/** 每个 runtimeVersion 保留的最新版本数 (含本次发布); 更早的删除 */
const KEEP_LATEST = 3;

/**
 * 发布后裁剪历史版本: 服务器永远只服务时间戳最大的目录,
 * 保留最近 N 个用于快速回滚 (及未来差分补丁的基线), 更早的删除。
 */
export function pruneOldUpdates(
  runtimeVersion: string,
  baseDir = path.join(SERVER_DIR, "updates"),
) {
  const dir = path.join(baseDir, runtimeVersion);
  const dirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(b) - Number(a)); // 新 -> 旧

  const stale = dirs.slice(KEEP_LATEST);
  for (const name of stale) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
    console.log(`清理历史版本: updates/${runtimeVersion}/${name}`);
  }
  console.log(
    stale.length
      ? `共清理 ${stale.length} 个历史版本, 保留最近 ${Math.min(KEEP_LATEST, dirs.length)} 个`
      : `历史版本共 ${dirs.length} 个, 无需清理`,
  );
}

function main() {
  const runtimeVersion = readRuntimeVersion();
  const ts = String(Date.now());
  const relPath = `updates/${runtimeVersion}/${ts}`;
  const target = path.join(SERVER_DIR, relPath);
  fs.mkdirSync(target, { recursive: true });

  if (process.argv[2] === "rollback") {
    publishRollback(target, relPath);
  } else {
    publishUpdate(target, relPath);
  }

  pruneOldUpdates(runtimeVersion);
}

// 被 import (如测试) 时不执行发布流程
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
