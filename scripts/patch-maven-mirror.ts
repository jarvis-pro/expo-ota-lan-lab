// 把 RN 预编译产物的下载源从 repo.reactnative.dev 替换为 Maven Central
// （该域名在本网络环境几乎不可用, 详见 docs/06-troubleshooting.md 第 3 条）
// 已挂在根 package.json 的 postinstall 上, pnpm install 后自动执行; 也可手动运行。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const NODE_MODULES = path.join(ROOT, "node_modules");
const FROM = "https://repo.reactnative.dev/maven2";
const TO = "https://repo1.maven.org/maven2";

/** 递归收集 node_modules 下的 .rb / .podspec 真实文件 (跳过符号链接, pnpm 真实内容在 .pnpm 里) */
function* collectTargets(dir: string): Generator<string> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // node_modules 尚未安装等情况
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* collectTargets(p);
    } else if (e.isFile() && /\.(rb|podspec)$/.test(e.name)) {
      yield p;
    }
  }
}

let patched = 0;
for (const file of collectTargets(NODE_MODULES)) {
  const content = fs.readFileSync(file, "utf8");
  if (!content.includes(FROM)) continue;
  fs.writeFileSync(file, content.replaceAll(FROM, TO));
  console.log(`patch-maven-mirror: 已补丁 ${path.relative(ROOT, file)}`);
  patched++;
}

if (patched === 0) {
  console.log("patch-maven-mirror: 无需补丁（未找到 repo.reactnative.dev 引用）");
}
