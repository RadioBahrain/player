import { statSync } from 'node:fs';

const rootDir = import.meta.dir;
const publicDir = `${rootDir}/public`;
const nodeModulesDir = `${rootDir}/node_modules`;

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.txt': 'text/plain; charset=utf-8'
};

function resolveFilePath(pathname: string) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const normalized = safePath.replace(/^\/+/, '');

  if (normalized.startsWith('node_modules/')) {
    return `${nodeModulesDir}/${normalized.replace(/^node_modules\//, '')}`;
  }

  return `${publicDir}/${normalized}`;
}

function contentType(pathname: string) {
  const ext = pathname.includes('.') ? pathname.slice(pathname.lastIndexOf('.')) : '';
  return mimeTypes[ext.toLowerCase()] ?? 'application/octet-stream';
}

const server = Bun.serve({
  port: 3000,
  fetch(request) {
    const url = new URL(request.url);
    const filePath = resolveFilePath(url.pathname);

    try {
      if (statSync(filePath).isFile()) {
        return new Response(Bun.file(filePath), {
          headers: {
            'Content-Type': contentType(filePath),
            'Cache-Control': 'no-cache'
          }
        });
      }
    } catch {
      // Fall through to the app shell.
    }

    const fallback = `${publicDir}/index.html`;
    try {
      if (statSync(fallback).isFile()) {
        return new Response(Bun.file(fallback), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }
    } catch {
      // Ignore fallback errors.
    }

    return new Response('Not found', { status: 404 });
  }
});

console.log(`Radio Bahrain player running at http://localhost:${server.port}`);
