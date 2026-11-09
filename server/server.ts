/**
 * 极简 expo-updates 协议 v1 局域网更新服务器（零运行时依赖，Node.js 原生 TypeScript 直跑）。
 * 协议行为参考官方示例 https://github.com/expo/custom-expo-updates-server
 *
 * 目录约定:
 *   updates/<runtimeVersion>/<timestamp>/   每次发布的 expo export 产物
 *     ├── metadata.json                     expo export 生成
 *     ├── expoConfig.json                   publish.sh 生成
 *     ├── _expo/static/...                  bundle 与资源
 *     └── rollback                          (可选) 存在该文件即表示回滚到内置包
 *
 * 运行: node server.ts   (默认 0.0.0.0:4747, HOSTNAME 用于生成资源 URL)
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getType } from './mime.ts';

const PORT = Number(process.env.PORT || 4747);
const HOSTNAME = process.env.HOSTNAME || 'http://192.168.0.105:4747';
const UPDATES_DIR = path.join(import.meta.dirname, 'updates');

// ---------- 类型定义 ----------

/** expo export 产物 metadata.json 的结构（只声明用到的部分） */
interface ExpoExportMetadata {
  fileMetadata: Record<string, PlatformFileMetadata>;
}

interface PlatformFileMetadata {
  /** launchAsset（JS bundle）相对更新包目录的路径 */
  bundle: string;
  /** 普通资源列表 */
  assets: { path: string; ext: string }[];
}

/** 协议 manifest 中的单个资源描述 */
interface AssetMetadata {
  hash: string;
  key: string;
  fileExtension: string;
  contentType: string;
  url: string;
}

/** expo-updates 协议 v1 的更新 manifest */
interface UpdateManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  assets: AssetMetadata[];
  launchAsset: AssetMetadata;
  metadata: Record<string, never>;
  extra: { expoClient: unknown };
}

interface MultipartPart {
  name: string;
  contentType: string;
  body: string;
  extraHeaders?: Record<string, string>;
}

// ---------- 工具函数（移植自官方示例 expo/custom-expo-updates-server） ----------

function getBase64URLEncoding(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 把 sha256 十六进制哈希截断为 UUID 形式，作为更新 ID */
function convertSHA256HashToUUID(value: string): string {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

/** 找到指定 runtimeVersion 下最新（时间戳目录名最大）的一次发布 */
async function getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion: string): Promise<string> {
  const dirForRuntimeVersion = path.join(UPDATES_DIR, runtimeVersion);
  if (!fs.existsSync(dirForRuntimeVersion)) {
    throw new Error(`Unsupported runtime version: ${runtimeVersion}`);
  }
  const entries = await fsp.readdir(dirForRuntimeVersion, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  if (!dirs.length) throw new Error(`No update found for runtime version: ${runtimeVersion}`);
  return path.join(dirForRuntimeVersion, dirs[0]);
}

/** 读取更新包的 metadata.json；其哈希即更新 ID，birthtime 即 commitTime */
async function getMetadataAsync(updateBundlePath: string): Promise<{
  metadataJson: ExpoExportMetadata;
  createdAt: string;
  id: string;
}> {
  const metadataPath = path.join(updateBundlePath, 'metadata.json');
  const buf = await fsp.readFile(metadataPath);
  const stat = await fsp.stat(metadataPath);
  return {
    metadataJson: JSON.parse(buf.toString('utf-8')),
    createdAt: new Date(stat.birthtime).toISOString(),
    id: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

/** 读取发布时生成的 expoConfig.json，塞进 manifest 的 extra.expoClient */
async function getExpoConfigAsync(updateBundlePath: string): Promise<unknown> {
  const buf = await fsp.readFile(path.join(updateBundlePath, 'expoConfig.json'));
  return JSON.parse(buf.toString('utf-8'));
}

interface GetAssetMetadataOptions {
  updateBundlePath: string;
  filePath: string;
  ext: string | null;
  isLaunchAsset: boolean;
  runtimeVersion: string;
  platform: string;
}

async function getAssetMetadataAsync(opts: GetAssetMetadataOptions): Promise<AssetMetadata> {
  const { updateBundlePath, filePath, ext, isLaunchAsset, runtimeVersion, platform } = opts;
  const assetFilePath = path.join(updateBundlePath, filePath);
  const asset = await fsp.readFile(assetFilePath);
  const assetHash = getBase64URLEncoding(crypto.createHash('sha256').update(asset).digest('base64'));
  const key = crypto.createHash('md5').update(asset).digest('hex');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext!;
  const contentType = isLaunchAsset ? 'application/javascript' : getType(ext);
  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url: `${HOSTNAME}/api/assets?asset=${encodeURIComponent(path.relative(UPDATES_DIR, assetFilePath))}&runtimeVersion=${runtimeVersion}&platform=${platform}`,
  };
}

// ---------- multipart 响应 ----------

/** 按协议返回 multipart/mixed 响应体（manifest 或 directive 二选一） */
function sendMultipart(res: http.ServerResponse, protocolVersion: number, parts: MultipartPart[]): void {
  const boundary = '----expoUpdatesBoundary' + crypto.randomBytes(8).toString('hex');
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `content-disposition: form-data; name="${part.name}"\r\n` +
      `content-type: ${part.contentType}\r\n` +
      (part.extraHeaders ? Object.entries(part.extraHeaders).map(([k, v]) => `${k}: ${v}\r\n`).join('') : '') +
      `\r\n`
    ));
    chunks.push(Buffer.from(part.body));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  res.writeHead(200, {
    'expo-protocol-version': String(protocolVersion),
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
    'content-type': `multipart/mixed; boundary=${boundary}`,
  });
  res.end(Buffer.concat(chunks));
}

/** 协议 v1 指令: 没有可用更新（客户端已是最新时返回） */
function sendNoUpdateAvailable(res: http.ServerResponse, protocolVersion: number): void {
  sendMultipart(res, protocolVersion, [
    {
      name: 'directive',
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ type: 'noUpdateAvailable' }),
    },
  ]);
}

/** 协议 v1 指令: 回滚到 App 内置 bundle */
function sendRollback(res: http.ServerResponse, protocolVersion: number, rollbackStat: fs.Stats): void {
  sendMultipart(res, protocolVersion, [
    {
      name: 'directive',
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        type: 'rollBackToEmbedded',
        parameters: { commitTime: new Date(rollbackStat.birthtime).toISOString() },
      }),
    },
  ]);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ---------- 接口 ----------

/** GET /api/manifest —— 客户端启动/手动检查更新时请求 */
async function handleManifest(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const headers = req.headers;
  const protocolVersion = parseInt(
    (headers['expo-protocol-version'] as string) ?? url.searchParams.get('protocol-version') ?? '0',
    10,
  );
  const platform = (headers['expo-platform'] as string) ?? url.searchParams.get('platform');
  const runtimeVersion = (headers['expo-runtime-version'] as string) ?? url.searchParams.get('runtime-version');

  if (platform !== 'ios' && platform !== 'android') {
    sendJson(res, 400, { error: 'Unsupported platform. Expected either ios or android.' });
    return;
  }
  if (!runtimeVersion) {
    sendJson(res, 400, { error: 'No runtimeVersion provided.' });
    return;
  }
  if (headers['expo-expect-signature']) {
    sendJson(res, 400, { error: 'Code signing requested but this lab server does not sign. Remove codeSigning config from the client.' });
    return;
  }

  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  } catch (error) {
    sendJson(res, 404, { error: (error as Error).message });
    return;
  }

  const currentUpdateId = headers['expo-current-update-id'] as string | undefined;
  const dirContents = await fsp.readdir(updateBundlePath);
  const isRollback = dirContents.includes('rollback');

  // 回滚发布: 目录里有 rollback 标记文件
  if (isRollback) {
    const embeddedUpdateId = headers['expo-embedded-update-id'] as string | undefined;
    if (!embeddedUpdateId) {
      sendJson(res, 400, { error: 'Invalid Expo-Embedded-Update-ID request header specified.' });
      return;
    }
    if (protocolVersion >= 1 && currentUpdateId === embeddedUpdateId) {
      console.log('[manifest] -> noUpdateAvailable (客户端已运行内置包, 无需回滚)');
      sendNoUpdateAvailable(res, protocolVersion);
      return;
    }
    const stat = await fsp.stat(path.join(updateBundlePath, 'rollback'));
    console.log(`[manifest] -> ROLLBACK directive (runtime=${runtimeVersion}, platform=${platform})`);
    sendRollback(res, 1, stat);
    return;
  }

  const { metadataJson, createdAt, id } = await getMetadataAsync(updateBundlePath);
  const updateUUID = convertSHA256HashToUUID(id);
  if (protocolVersion >= 1 && currentUpdateId === updateUUID) {
    console.log(`[manifest] -> noUpdateAvailable (client already on ${updateUUID})`);
    sendNoUpdateAvailable(res, protocolVersion);
    return;
  }

  const expoConfig = await getExpoConfigAsync(updateBundlePath);
  const platformMetadata = metadataJson.fileMetadata[platform];
  const manifest: UpdateManifest = {
    id: updateUUID,
    createdAt,
    runtimeVersion,
    assets: await Promise.all(
      (platformMetadata.assets || []).map((asset) =>
        getAssetMetadataAsync({ updateBundlePath, filePath: asset.path, ext: asset.ext, isLaunchAsset: false, runtimeVersion, platform }),
      ),
    ),
    launchAsset: await getAssetMetadataAsync({
      updateBundlePath,
      filePath: platformMetadata.bundle,
      isLaunchAsset: true,
      runtimeVersion,
      platform,
      ext: null,
    }),
    metadata: {},
    extra: { expoClient: expoConfig },
  };

  const extensions = { assetRequestHeaders: {} };
  console.log(`[manifest] -> update ${updateUUID} (runtime=${runtimeVersion}, platform=${platform}, assets=${manifest.assets.length})`);
  sendMultipart(res, protocolVersion, [
    { name: 'manifest', contentType: 'application/json; charset=utf-8', body: JSON.stringify(manifest) },
    { name: 'extensions', contentType: 'application/json', body: JSON.stringify(extensions) },
  ]);
}

/** GET /api/assets —— 客户端按 manifest 里的 url 逐个下载 bundle 和资源 */
async function handleAssets(_req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const assetName = url.searchParams.get('asset');
  const runtimeVersion = url.searchParams.get('runtimeVersion');
  const platform = url.searchParams.get('platform');

  if (!assetName || !runtimeVersion || (platform !== 'ios' && platform !== 'android')) {
    sendJson(res, 400, { error: 'Expected query params: asset, runtimeVersion, platform(ios|android).' });
    return;
  }

  // assetName 是相对 updates/ 目录的路径, 防止目录穿越。
  // 注意用 UPDATES_DIR + path.sep 做前缀: 纯字符串 startsWith 会把同名前缀的
  // 兄弟目录（如 server/updates-evil/）误判为目录内路径。
  const assetPath = path.resolve(UPDATES_DIR, assetName);
  if (!assetPath.startsWith(UPDATES_DIR + path.sep) || !fs.existsSync(assetPath)) {
    sendJson(res, 404, { error: `Asset "${assetName}" does not exist.` });
    return;
  }

  const updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  const { metadataJson } = await getMetadataAsync(updateBundlePath);
  const relativeToBundle = path.relative(updateBundlePath, assetPath).split(path.sep).join('/');
  const platformMetadata = metadataJson.fileMetadata[platform];
  const isLaunchAsset = platformMetadata.bundle === relativeToBundle;
  const assetMeta = (platformMetadata.assets || []).find((a) => a.path === relativeToBundle);

  const data = await fsp.readFile(assetPath);
  const contentType = isLaunchAsset ? 'application/javascript' : assetMeta ? getType(assetMeta.ext) : 'application/octet-stream';
  console.log(`[assets]  -> ${path.basename(assetPath)} (${data.length} bytes, ${contentType})`);
  res.writeHead(200, { 'content-type': contentType, 'content-length': data.length });
  res.end(data);
}

// ---------- 服务器入口 ----------

const server = http.createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', HOSTNAME);
    const t0 = Date.now();
    console.log(`[req] ${req.method} ${url.pathname} platform=${req.headers['expo-platform'] ?? '-'} runtime=${req.headers['expo-runtime-version'] ?? '-'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/manifest') {
        await handleManifest(req, res, url);
      } else if (req.method === 'GET' && url.pathname === '/api/assets') {
        await handleAssets(req, res, url);
      } else if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        sendJson(res, 200, { ok: true, updatesDir: UPDATES_DIR, hostname: HOSTNAME });
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (error) {
      console.error('[error]', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String((error as Error)?.message || error) }));
    } finally {
      console.log(`[req] done in ${Date.now() - t0}ms`);
    }
  })();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`expo-updates LAN server listening on ${HOSTNAME} (port ${PORT})`);
  console.log(`serving updates from: ${UPDATES_DIR}`);
});
