import puppeteer from 'puppeteer-core';
import { mkdir, unlink } from 'node:fs/promises';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TARGET_URL = 'https://bh.here.now';

async function main() {
  await mkdir('screenshots', { recursive: true });

  console.log('🚀 Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--hide-scrollbars',
      '--disable-gpu',
      '--force-device-scale-factor=2'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    
    console.log('🌐 Navigating to', TARGET_URL);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // 1. Splash Screen Desktop
    console.log('📸 1/5 Capturing Desktop Splash Screen...');
    await page.waitForSelector('#startButton.visible', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: 'screenshots/splash-screen.png' });

    // 2. Start Listening & Wait for UI Entrance
    console.log('▶️ Clicking start button and waiting for player entrance...');
    await page.click('#startButton');
    await new Promise((r) => setTimeout(r, 4000));

    // Helper to stimulate active playback state and visualizer wave
    const activateVisuals = async () => {
      await page.evaluate(() => {
        const statusText = document.getElementById('statusText');
        const liveDot = document.getElementById('liveDot');
        if (statusText) statusText.textContent = 'مباشر • LIVE';
        if (liveDot) liveDot.className = 'live-dot live';

        const playIcon = document.getElementById('playIcon');
        if (playIcon) playIcon.textContent = '⏸';
        const logoHit = document.getElementById('btnPower');
        if (logoHit) logoHit.classList.add('playing');

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
      await new Promise((r) => setTimeout(r, 500));
    };

    await activateVisuals();

    // 2. Desktop Hero (Shabab 98.4 FM)
    console.log('📸 2/5 Capturing Desktop Hero (Shabab 98.4 FM)...');
    await page.screenshot({ path: 'screenshots/player-hero-desktop.png' });

    // 3. Bahrain FM 93.3
    console.log('📸 3/5 Capturing Bahrain FM 93.3...');
    await page.evaluate(() => {
      const btn = document.querySelector('.station-pill[data-channel="bahrain"]') as HTMLElement;
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 3800));
    await activateVisuals();
    await page.screenshot({ path: 'screenshots/station-bahrain-93-3.png' });

    // 4. Shaabia 95.0 FM
    console.log('📸 4/5 Capturing Shaabia 95.0 FM...');
    await page.evaluate(() => {
      const btn = document.querySelector('.station-pill[data-channel="shaabia"]') as HTMLElement;
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 3800));
    await activateVisuals();
    await page.screenshot({ path: 'screenshots/station-shaabia-95-0.png' });

    await page.close();

    // 5. Mobile Views (iPhone 15 Pro: 393 x 852)
    console.log('📸 5/5 Capturing Mobile Views...');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mobilePage.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await mobilePage.waitForSelector('#startButton.visible', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await mobilePage.screenshot({ path: 'screenshots/splash-screen-mobile.png' });

    await mobilePage.click('#startButton');
    await new Promise((r) => setTimeout(r, 4000));

    await mobilePage.evaluate(() => {
      const statusText = document.getElementById('statusText');
      const liveDot = document.getElementById('liveDot');
      if (statusText) statusText.textContent = 'مباشر • LIVE';
      if (liveDot) liveDot.className = 'live-dot live';
      const playIcon = document.getElementById('playIcon');
      if (playIcon) playIcon.textContent = '⏸';
      const logoHit = document.getElementById('btnPower');
      if (logoHit) logoHit.classList.add('playing');

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
    await new Promise((r) => setTimeout(r, 500));
    await mobilePage.screenshot({ path: 'screenshots/player-hero-mobile.png' });
    await mobilePage.close();

    try {
      await unlink('screenshots/test-splash.png');
    } catch {}

    console.log('🎉 All high-resolution screenshots generated successfully!');
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
