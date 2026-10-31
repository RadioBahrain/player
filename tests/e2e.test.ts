import { test, expect, beforeAll, afterAll } from "bun:test";
import puppeteer, { type Browser } from "puppeteer-core";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TEST_PORT = 3488;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const SCREENSHOTS_DIR = "screenshots";

let serverProc: ReturnType<typeof Bun.spawn> | null = null;
let browser: Browser | null = null;

beforeAll(async () => {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Start the local Bun server on TEST_PORT
  serverProc = Bun.spawn(["bun", "server.ts"], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });

  // Wait until the server responds
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--autoplay-policy=no-user-gesture-required",
      "--force-device-scale-factor=2",
    ],
  });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
  if (serverProc) serverProc.kill();
});

test("Favicons & Web Manifest are served with HTTP 200 and valid content-types", async () => {
  const assets = [
    { path: "/favicon.svg", type: "image/svg+xml" },
    { path: "/favicon.ico", type: "image/x-icon" },
    { path: "/favicon-32x32.png", type: "image/png" },
    { path: "/favicon-16x16.png", type: "image/png" },
    { path: "/apple-touch-icon.png", type: "image/png" },
    { path: "/android-chrome-192x192.png", type: "image/png" },
    { path: "/android-chrome-512x512.png", type: "image/png" },
    { path: "/site.webmanifest", type: "application/manifest+json" },
    { path: "/lib/gsap.js", type: "javascript" },
    { path: "/lib/hls.js", type: "javascript" },
    { path: "/podcasts", type: "text/html" },
    { path: "/podcasts.html", type: "text/html" },
  ];

  for (const asset of assets) {
    const res = await fetch(`${BASE_URL}${asset.path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(asset.type);
  }
});

test("Desktop Live Player: splash screen, circle alignment, station switching, and screenshots", async () => {
  const page = await browser!.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#startButton.visible", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  // Capture splash screen
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/splash-screen.png` });
  expect(existsSync(`${SCREENSHOTS_DIR}/splash-screen.png`)).toBe(true);

  // Enter player
  await page.click("#startButton");
  await page.waitForSelector("#splash.hidden", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1800));

  // Activate visualizer waves for screenshot presentation
  const activateVisuals = async () => {
    await page.evaluate(() => {
      const statusText = document.getElementById("statusText");
      const liveDot = document.getElementById("liveDot");
      if (statusText) statusText.textContent = "مباشر • LIVE";
      if (liveDot) liveDot.className = "live-dot live";

      const playIcon = document.getElementById("playIcon");
      if (playIcon) playIcon.textContent = "⏸";
      const logoHit = document.getElementById("btnPower");
      if (logoHit) logoHit.classList.add("playing");

      const count = 96;
      const win = window as any;
      if (win.smoothed && win.peaks) {
        for (let i = 0; i < count; i++) {
          const wave = Math.sin((i / count) * Math.PI * 4) * 0.35 + 0.55;
          const detail = (Math.sin(i * 1.5) + 1) * 0.15;
          win.smoothed[i] = Math.min(0.95, Math.max(0.18, wave + detail));
          win.peaks[i] = win.smoothed[i] + 0.04;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 400));
  };

  await activateVisuals();

  // Verify background disc alignment with RADIO button on desktop
  const alignment = await page.evaluate(() => {
    const rect = document.getElementById("btnPower")!.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const focusX = parseFloat(cs.getPropertyValue("--bg-focus-x"));
    const focusY = parseFloat(cs.getPropertyValue("--bg-focus-y"));
    const btnCx = rect.left + rect.width / 2;
    const btnCy = rect.top + rect.height / 2;
    return {
      dx: Math.abs(focusX - btnCx),
      dy: Math.abs(focusY - btnCy),
      hasPodcastLink: !!document.querySelector('a.podcast-btn[href="/podcasts"]'),
    };
  });

  expect(alignment.dx).toBeLessThan(2);
  expect(alignment.dy).toBeLessThan(2);
  expect(alignment.hasPodcastLink).toBe(true);

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/player-hero-desktop.png` });

  // Switch to Bahrain FM 93.3
  await page.click('.station-pill[data-channel="bahrain"]');
  await new Promise((r) => setTimeout(r, 3600));
  await activateVisuals();
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/station-bahrain-93-3.png` });

  // Switch to Shaabia 95.0 FM
  await page.click('.station-pill[data-channel="shaabia"]');
  await new Promise((r) => setTimeout(r, 3600));
  await activateVisuals();
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/station-shaabia-95-0.png` });

  await page.close();
}, 45000);

test("Mobile Live Player: circle alignment verification and mobile hero screenshot", async () => {
  const page = await browser!.newPage();
  await page.setViewport({
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#startButton.visible", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/splash-screen-mobile.png` });

  await page.click("#startButton");
  await page.waitForSelector("#splash.hidden", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1800));

  const mobileAlignment = await page.evaluate(() => {
    const statusText = document.getElementById("statusText");
    const liveDot = document.getElementById("liveDot");
    if (statusText) statusText.textContent = "مباشر • LIVE";
    if (liveDot) liveDot.className = "live-dot live";
    const playIcon = document.getElementById("playIcon");
    if (playIcon) playIcon.textContent = "⏸";
    const logoHit = document.getElementById("btnPower")!;
    logoHit.classList.add("playing");

    const count = 96;
    const win = window as any;
    if (win.smoothed && win.peaks) {
      for (let i = 0; i < count; i++) {
        const wave = Math.sin((i / count) * Math.PI * 4) * 0.35 + 0.55;
        const detail = (Math.sin(i * 1.5) + 1) * 0.15;
        win.smoothed[i] = Math.min(0.95, Math.max(0.18, wave + detail));
        win.peaks[i] = win.smoothed[i] + 0.04;
      }
    }

    const rect = logoHit.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const focusX = parseFloat(cs.getPropertyValue("--bg-focus-x"));
    const focusY = parseFloat(cs.getPropertyValue("--bg-focus-y"));
    const [wStr, hStr] = cs.getPropertyValue("--bg-size").trim().split(/\s+/);
    const [leftStr, topStr] = cs.getPropertyValue("--bg-pos").trim().split(/\s+/);
    const bgW = parseFloat(wStr);
    const bgH = parseFloat(hStr);
    const bgLeft = parseFloat(leftStr);
    const bgTop = parseFloat(topStr);

    // Disc center in artwork is (0.501 * bgW + bgLeft, 0.417 * bgH + bgTop)
    const discCx = bgLeft + 0.501 * bgW;
    const discCy = bgTop + 0.417 * bgH;
    const btnCx = rect.left + rect.width / 2;
    const btnCy = rect.top + rect.height / 2;

    return {
      dx: Math.abs(discCx - btnCx),
      dy: Math.abs(discCy - btnCy),
      focusX,
      focusY,
    };
  });

  expect(mobileAlignment.dx).toBeLessThan(2);
  expect(mobileAlignment.dy).toBeLessThan(2);

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/player-hero-mobile.png` });
  await page.close();
}, 40000);

test("3D Podcasts Archive (/podcasts): Cover-Flow carousel, vinyl physics, episodes drawer, and screenshots", async () => {
  const page = await browser!.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  await page.goto(`${BASE_URL}/podcasts`, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector(".slide .sleeve.active", { timeout: 10000 });
  // Allow initial animations and vinyl slide-out to settle
  await new Promise((r) => setTimeout(r, 1500));

  const initialState = await page.evaluate(() => {
    const slides = document.querySelectorAll(".slide");
    const activeSleeve = document.querySelector(".slide .sleeve.active");
    const title = document.getElementById("titleMain")?.textContent?.trim() || "";
    const countPill = document.getElementById("countPill")?.textContent?.trim() || "";
    const liveLink = document.querySelector('a.pill.live[href="/"]');
    return {
      slideCount: slides.length,
      hasActiveSleeve: !!activeSleeve,
      title,
      countPill,
      hasLiveLink: !!liveLink,
    };
  });

  expect(initialState.slideCount).toBeGreaterThan(10);
  expect(initialState.hasActiveSleeve).toBe(true);
  expect(initialState.title.length).toBeGreaterThan(0);
  expect(initialState.hasLiveLink).toBe(true);

  // Navigate to index 2 so Cover-Flow shows albums flanking both sides of the active vinyl
  await page.click("#nextBtn");
  await new Promise((r) => setTimeout(r, 400));
  await page.click("#nextBtn");
  await new Promise((r) => setTimeout(r, 1400));

  const afterNavState = await page.evaluate(() => {
    const activeImg = document.querySelector(".slide .sleeve.active img") as HTMLImageElement | null;
    return {
      title: document.getElementById("titleMain")?.textContent?.trim() || "",
      imgLoaded: !!activeImg && activeImg.complete && activeImg.naturalWidth > 100,
    };
  });
  expect(afterNavState.title).not.toBe(initialState.title);
  expect(afterNavState.imgLoaded).toBe(true);

  // Capture Desktop 3D Cover-Flow screenshot
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/podcasts-coverflow-desktop.png` });
  expect(existsSync(`${SCREENSHOTS_DIR}/podcasts-coverflow-desktop.png`)).toBe(true);

  // Open Episodes Drawer on active slide
  await page.click(".slide .sleeve.active .viewBtn");
  await page.waitForSelector("#episodesOverlay.open", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1000));

  const drawerState = await page.evaluate(() => {
    const cards = document.querySelectorAll("#episodesGrid .epCard");
    const epTitle = document.getElementById("epTitle")?.textContent?.trim() || "";
    return {
      episodeCardsCount: cards.length,
      epTitle,
    };
  });

  expect(drawerState.episodeCardsCount).toBeGreaterThan(0);
  expect(drawerState.epTitle).toBe(afterNavState.title);

  // Capture Episodes Drawer screenshot
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/podcasts-episodes-drawer.png` });
  expect(existsSync(`${SCREENSHOTS_DIR}/podcasts-episodes-drawer.png`)).toBe(true);

  // Close drawer
  await page.click("#epClose");
  await new Promise((r) => setTimeout(r, 700));

  // Mobile viewport verification for /podcasts
  await page.setViewport({
    width: 393,
    height: 852,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/podcasts-coverflow-mobile.png` });
  expect(existsSync(`${SCREENSHOTS_DIR}/podcasts-coverflow-mobile.png`)).toBe(true);

  await page.close();
}, 45000);
