import { statSync } from 'node:fs';

const rootDir = import.meta.dir;
const publicDir = `${rootDir}/public`;
const nodeModulesDir = `${rootDir}/node_modules`;

let ytLiveCache: { timestamp: number; data: any } = { timestamp: 0, data: null };
const activeListeners = new Map<string, number>();
const LISTENER_ACTIVE_TTL_MS = 75 * 1000;

function cleanupActiveListeners(now = Date.now()) {
  for (const [sid, lastSeen] of activeListeners.entries()) {
    if (now - lastSeen > LISTENER_ACTIVE_TTL_MS) {
      activeListeners.delete(sid);
    }
  }
}

async function getYouTubeLiveStatus() {
  const now = Date.now();
  if (ytLiveCache.data && now - ytLiveCache.timestamp < 25000) {
    return ytLiveCache.data;
  }

  const channelHandle = 'Radio-Bahrain';
  const channelId = 'UCylIWXb8bRI0KcDeJG6H8rw';

  let isLive = false;
  let videoId: string | null = null;
  let title: string | null = null;

  try {
    // 1. Check live stream page
    const liveRes = await fetch(`https://www.youtube.com/@${channelHandle}/live`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US,en;q=0.9'
      }
    });

    if (liveRes.ok) {
      const liveText = await liveRes.text();
      const canonicalMatch = liveText.match(/<link rel="canonical" href="([^"]+)">/);
      const canonical = canonicalMatch ? canonicalMatch[1] : '';
      const isWatchUrl = canonical.includes('youtube.com/watch?v=');

      const isUpcoming = liveText.includes('"isUpcoming":true');
      const isLiveNow =
        (liveText.includes('"isLiveNow":true') ||
          liveText.includes('"status":"LIVE"') ||
          liveText.includes('"liveBroadcastDetails":{"isLiveNow":true') ||
          liveText.includes('"liveStreamabilityRenderer"')) &&
        !isUpcoming;

      const endTimestampMatch = liveText.match(/"endTimestamp":"([^"]+)"/);
      const hasEnded = Boolean(endTimestampMatch);

      if (isWatchUrl && isLiveNow && !hasEnded) {
        isLive = true;
        const vidMatch = canonical.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
        videoId = vidMatch ? vidMatch[1] : null;
        const titleMatch = liveText.match(/<meta property="og:title" content="([^"]+)">/);
        const rawTitle = titleMatch ? titleMatch[1] : '';
        title = rawTitle.replace(/ - YouTube$/, '').trim() || 'بث مباشر - إذاعة البحرين';
      }
    }
  } catch (err) {
    console.error('Fetch live error:', err);
  }

  // 2. If not actively live, get the latest broadcast from channel RSS feed
  if (!videoId) {
    try {
      const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      if (rssRes.ok) {
        const rssXml = await rssRes.text();
        const vMatch = rssXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
        const tMatch = rssXml.match(/<entry>[\s\S]*?<title>([^<]+)<\/title>/);
        if (vMatch && vMatch[1]) {
          videoId = vMatch[1];
          title = tMatch ? tMatch[1].trim() : 'تسجيل البث - إذاعة البحرين';
        }
      }
    } catch (rssErr) {
      console.error('RSS fetch error:', rssErr);
    }
  }

  const finalVideoId = videoId || '8zVmt23lYGs';
  const finalTitle = title || (isLive ? 'بث مباشر - إذاعة البحرين' : 'إذاعة البحرين • البث المرئي');

  const data = {
    isLive,
    videoId: finalVideoId,
    title: finalTitle,
    embedUrl: `https://www.youtube-nocookie.com/embed/${finalVideoId}?autoplay=${isLive ? 1 : 0}&enablejsapi=1&playsinline=1`,
    watchUrl: `https://www.youtube.com/watch?v=${finalVideoId}`,
    checkedAt: new Date().toISOString()
  };

  ytLiveCache = { timestamp: now, data };
  return data;
}

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

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/listeners-now') {
      const now = Date.now();
      const sid = (url.searchParams.get('sid') || '').trim();
      if (sid) {
        activeListeners.set(sid, now);
      }
      cleanupActiveListeners(now);

      return new Response(JSON.stringify({
        listeners: activeListeners.size,
        checkedAt: new Date(now).toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (url.pathname === '/api/youtube-live') {
      const data = await getYouTubeLiveStatus();
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

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

