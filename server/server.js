/**
 * 极简 expo-updates 协议 v1 局域网更新服务器（零依赖，Node.js 原生实现）。
 * 协议行为参考官方示例 https://github.com/expo/custom-expo-updates-server
 *
 * 目录约定:
 *   updates/<runtimeVersion>/<timestamp>/   每次发布的 expo export 产物
 *     ├── metadata.json                     expo export 生成
 *     ├── expoConfig.json                   publish.sh 生成
 *     ├── _expo/static/...                  bundle 与资源
 *     └── rollback                          (可选) 存在该文件即表示回滚到内置包
 *
 * 运行: node server.js   (默认 0.0.0.0:4747, HOSTNAME 用于生成资源 URL)
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const mime = require('./mime');

const PORT = process.env.PORT || 4747;
const HOSTNAME = process.env.HOSTNAME || 'http://192.168.0.105:4747';
const UPDATES_DIR = path.join(__dirname, 'updates');

class NoUpdateAvailableError extends Error {}

// ---------- 工具函数（移植自官方示例 expo/custom-expo-updates-server） ----------

function getBase64URLEncoding(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function convertSHA256HashToUUID(value) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

async function getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion) {
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

async function getMetadataAsync(updateBundlePath) {
  const metadataPath = path.join(updateBundlePath, 'metadata.json');
  const buf = await fsp.readFile(metadataPath);
  const stat = await fsp.stat(metadataPath);
  return {
    metadataJson: JSON.parse(buf.toString('utf-8')),
    createdAt: new Date(stat.birthtime).toISOString(),
    id: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

async function getExpoConfigAsync(updateBundlePath) {
  const buf = await fsp.readFile(path.join(updateBundlePath, 'expoConfig.json'));
  return JSON.parse(buf.toString('utf-8'));
}

async function getAssetMetadataAsync({ updateBundlePath, filePath, ext, isLaunchAsset, runtimeVersion, platform }) {
  const assetFilePath = path.join(updateBundlePath, filePath);
  const asset = await fsp.readFile(assetFilePath);
  const assetHash = getBase64URLEncoding(crypto.createHash('sha256').update(asset).digest('base64'));
  const key = crypto.createHash('md5').update(asset).digest('hex');
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext;
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext);
  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url: `${HOSTNAME}/api/assets?asset=${encodeURIComponent(path.relative(UPDATES_DIR, assetFilePath))}&runtimeVersion=${runtimeVersion}&platform=${platform}`,
  };
}

// ---------- multipart 响应 ----------

function sendMultipart(res, protocolVersion, parts) {
  const boundary = '----expoUpdatesBoundary' + crypto.randomBytes(8).toString('hex');
  const chunks = [];
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

function sendNoUpdateAvailable(res, protocolVersion) {
  sendMultipart(res, protocolVersion, [
    {
      name: 'directive',
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ type: 'noUpdateAvailable' }),
    },
  ]);
}

function sendRollback(res, protocolVersion, rollbackStat) {
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

// ---------- 接口 ----------

async function handleManifest(req, res, url) {
  const headers = req.headers;
  const protocolVersion = parseInt(headers['expo-protocol-version'] ?? url.searchParams.get('protocol-version') ?? '0', 10);
  const platform = headers['expo-platform'] ?? url.searchParams.get('platform');
  const runtimeVersion = headers['expo-runtime-version'] ?? url.searchParams.get('runtime-version');

  if (platform !== 'ios' && platform !== 'android') {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unsupported platform. Expected either ios or android.' }));
    return;
  }
  if (!runtimeVersion) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'No runtimeVersion provided.' }));
    return;
  }
  if (headers['expo-expect-signature']) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Code signing requested but this lab server does not sign. Remove codeSigning config from the client.' }));
    return;
  }

  let updateBundlePath;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
    return;
  }

  const currentUpdateId = headers['expo-current-update-id'];
  const dirContents = await fsp.readdir(updateBundlePath);
  const isRollback = dirContents.includes('rollback');

  if (isRollback) {
    const embeddedUpdateId = headers['expo-embedded-update-id'];
    if (!embeddedUpdateId) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid Expo-Embedded-Update-ID request header specified.' }));
      return;
    }
    if (protocolVersion >= 1 && currentUpdateId === embeddedUpdateId) {
      console.log(`[manifest] -> noUpdateAvailable (客户端已运行内置包, 无需回滚)`);
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
  const manifest = {
    id: updateUUID,
    createdAt,
    runtimeVersion,
    assets: await Promise.all(
      (platformMetadata.assets || []).map((asset) =>
        getAssetMetadataAsync({ updateBundlePath, filePath: asset.path, ext: asset.ext, isLaunchAsset: false, runtimeVersion, platform })
      )
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

async function handleAssets(req, res, url) {
  const assetName = url.searchParams.get('asset');
  const runtimeVersion = url.searchParams.get('runtimeVersion');
  const platform = url.searchParams.get('platform');

  if (!assetName || !runtimeVersion || (platform !== 'ios' && platform !== 'android')) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Expected query params: asset, runtimeVersion, platform(ios|android).' }));
    return;
  }

  // assetName 是相对 updates/ 目录的路径, 防止目录穿越
  const assetPath = path.resolve(UPDATES_DIR, assetName);
  if (!assetPath.startsWith(UPDATES_DIR) || !fs.existsSync(assetPath)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `Asset "${assetName}" does not exist.` }));
    return;
  }

  const updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  const { metadataJson } = await getMetadataAsync(updateBundlePath);
  const relativeToBundle = path.relative(updateBundlePath, assetPath).split(path.sep).join('/');
  const platformMetadata = metadataJson.fileMetadata[platform];
  const isLaunchAsset = platformMetadata.bundle === relativeToBundle;
  const assetMeta = (platformMetadata.assets || []).find((a) => a.path === relativeToBundle);

  const data = await fsp.readFile(assetPath);
  const contentType = isLaunchAsset ? 'application/javascript' : (assetMeta ? mime.getType(assetMeta.ext) : 'application/octet-stream');
  console.log(`[assets]  -> ${path.basename(assetPath)} (${data.length} bytes, ${contentType})`);
  res.writeHead(200, { 'content-type': contentType, 'content-length': data.length });
  res.end(data);
}

// ---------- 服务器入口 ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, HOSTNAME);
  const t0 = Date.now();
  console.log(`[req] ${req.method} ${url.pathname} platform=${req.headers['expo-platform'] ?? '-'} runtime=${req.headers['expo-runtime-version'] ?? '-'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/manifest') {
      await handleManifest(req, res, url);
    } else if (req.method === 'GET' && url.pathname === '/api/assets') {
      await handleAssets(req, res, url);
    } else if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, updatesDir: UPDATES_DIR, hostname: HOSTNAME }));
    } else {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (error) {
    console.error('[error]', error);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(error && error.message || error) }));
  } finally {
    console.log(`[req] done in ${Date.now() - t0}ms`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`expo-updates LAN server listening on ${HOSTNAME} (port ${PORT})`);
  console.log(`serving updates from: ${UPDATES_DIR}`);
});
