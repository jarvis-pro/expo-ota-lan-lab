// 用法: node exportConfig.js <expo项目目录>
// 输出该项目的 public expo config JSON 到 stdout (写入更新包的 expoConfig.json)
const path = require('path');
const projectDir = path.resolve(process.argv[2]);
const { getConfig } = require(require.resolve('@expo/config', { paths: [projectDir] }));
const { exp } = getConfig(projectDir, {
  skipSDKVersionRequirement: true,
  isPublicConfig: true,
});
process.stdout.write(JSON.stringify(exp));
