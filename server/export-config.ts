// 用法: node export-config.ts <expo项目目录>
// 输出该项目的 public expo config JSON 到 stdout (写入更新包的 expo-config.json)
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const projectDir = path.resolve(process.argv[2]);
const { getConfig } = require(require.resolve('@expo/config', { paths: [projectDir] }));
const { exp } = getConfig(projectDir, {
  skipSDKVersionRequirement: true,
  isPublicConfig: true,
});
process.stdout.write(JSON.stringify(exp));
