// 极简 mime 映射, 覆盖 expo export 常见资源类型
const MAP: Record<string, string> = {
  js: 'application/javascript',
  bundle: 'application/javascript',
  hbc: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  css: 'text/css',
  html: 'text/html',
  txt: 'text/plain',
};

export function getType(ext: string | null | undefined): string {
  if (!ext) return 'application/octet-stream';
  const key = String(ext).replace(/^\./, '').toLowerCase();
  return MAP[key] || 'application/octet-stream';
}
