// pnpm node-linker=hoisted 会把 workspace 内所有依赖提升到仓库根 node_modules,
// 子包自己的 node_modules 不再存在; 而生成的 iOS 工程里保留了 apps/ota-demo/../node_modules
// 形式的相对引用 (Pods 工程、HERMES_CLI_PATH 等)。
// 这里用符号链接把这些相对引用指回根 node_modules, 对齐 npm 时代的布局。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

for (const pkg of ["apps/ota-demo", "apps/server"]) {
  const link = path.join(ROOT, pkg, "node_modules");
  try {
    fs.lstatSync(link); // 已存在（符号链接或 pnpm 自建目录）则不动
    continue;
  } catch {
    // 不存在, 创建链接
  }
  // junction: Windows 上无需管理员权限的目录链接 (target 会被自动绝对化)
  fs.symlinkSync("../../node_modules", link, "junction");
  console.log(`link-hoisted-modules: ${pkg}/node_modules -> ../../node_modules`);
}
