# Radio Bahrain Player — Technical & Architectural Overview

This document details the runtime architecture, mathematical coordinate solver, 3D Cover-Flow physics engine, static/dynamic server compatibility, and automated E2E visual verification suite for the **Radio Bahrain Player** repository.

![Radio Bahrain Player Hero](../screenshots/player-hero-desktop.png)

---

## 1. Runtime & Bundling Architecture

The project is engineered to run identically under both **Bun's dynamic HTTP server** and **any standalone static file server**:

- **Local Development & Production Server ([`server.ts`](../server.ts))**:
  - Serves `public/index.html` at `/`.
  - Serves `public/podcasts.html` (and `public/podcasts/index.html`) at `/podcasts`, `/podcasts/`, and `/podcasts.html`.
  - Exposes `/api/listeners-now` (queries Radio Bahrain's Icecast/Shoutcast endpoints with a 15-second cache) and `/api/youtube-live` (checks `@Radio-Bahrain` live broadcast status with a 60-second cache).
- **Direct Static Serving from `public/` (`php -S`, `python -m http.server`, `serve`)**:
  - `public/lib/gsap.js` and `public/lib/hls.js` are stored directly in `public/lib/`, and `public/podcasts/index.html` provides directory-index resolution for `/podcasts`.
  - Running `php -S localhost:8011 -t ./` inside `public/` serves both `/` and `/podcasts` with zero missing dependencies or rewrite rules required.
- **Static Distribution Bundler ([`build.ts`](../build.ts))**:
  - Cleans `dist/` and copies `public/` (filtering out `.DS_Store`, `Thumbs.db`, `._*`).
  - Syncs `node_modules/gsap/dist/gsap.js` and `node_modules/hls.js/dist/hls.js` into both `public/lib/` and `dist/lib/`.
  - Syncs `public/podcasts/index.html` and `dist/podcasts/index.html`.
  - Embeds `<meta name="version" content="..." />` into `dist/index.html` and emits `dist/version.json`.

---

## 2. Pixel-Locked Background Artwork Alignment (`public/index.html`)

Every station background in `public/assets/` (`1136×2080`) contains a central circular red microphone emblem whose intrinsic geometry (`BG_ART`) is:
- Aspect ratio: `aspect = 1136 / 2080`
- Horizontal center: `cx = 0.501` (`569.1px` of `1136px`)
- Vertical center: `cy = 0.417` (`867.4px` of `2080px`)
- Intrinsic diameter: `d = 0.195` of image height (`405.6px` of `2080px`)

### Coordinate Solver (`syncBackgroundFocusToPlaybackButton()`)
1. Measures the live `getBoundingClientRect()` of `#btnPower` (or `#splashLogo` while the splash screen is active) and divides out any temporary GSAP entrance scale transform to obtain the untransformed diameter `btnDiameter`.
2. Computes the exact rendered image dimensions so the baked-in artwork disc matches the button diameter:
   - `imgH = btnDiameter / BG_ART.d`
   - `imgW = imgH * BG_ART.aspect`
3. Computes the exact pixel offset so the artwork disc center `(0.501 * imgW, 0.417 * imgH)` lands directly on the button center `(ax, ay)`:
   - `posX = ax - BG_ART.cx * imgW`
   - `posY = ay - BG_ART.cy * imgH`
4. Writes `--bg-size: <imgW>px <imgH>px` and `--bg-pos: <posX>px <posY>px` to `document.documentElement`, updating on GSAP `entranceTl` ticks, window resize, and mobile `visualViewport` events.

| Desktop Alignment (`1440×900`) | Mobile Alignment (`393×852`) |
| :---: | :---: |
| ![Desktop Alignment](../screenshots/player-hero-desktop.png) | ![Mobile Alignment](../screenshots/player-hero-mobile.png) |

---

## 3. 3D Vinyl Podcasts Archive (`public/podcasts.html`)

Accessible at `/podcasts` and `/podcasts.html`, [`public/podcasts.html`](../public/podcasts.html) renders a 60fps 3D Cover-Flow carousel for Radio Bahrain's 47 playlists (810 episodes):

- **60fps Spring Interpolation**:
  - `currentPos += (targetIdx - currentPos) * 0.11` smoothly interpolates toward the selected index and applies 3D perspective transforms (`translate3d`, `rotationY`, `scale`, `blur`) to each `.slide`.
- **Active-Only Specular Shine**:
  - `.shine` is hidden and paused (`opacity: 0; animation: none`) on all inactive sleeves and enabled exclusively on `.sleeve.active`, focusing visual attention on the highlighted album while eliminating background GPU overdraw.
- **Extended Vinyl Peek & Center Label**:
  - `.vinyl` (`top: 2.5%; left: 2.5%; width: 95%; height: 95%`) slides out to `xPercent: 46` on desktop (`~132px` beyond the sleeve edge) and `xPercent: 44` on mobile (`~87px` beyond the sleeve edge) while spinning continuously (`360deg` every `4s`), revealing the custom center label (`.vLabel`), gold ring, metallic groove sheen, and spindle hole.
  - Neighboring right-hand slides shift by `rightClearance` (`56px` desktop / `38px` mobile) so the peeking vinyl is never crowded.
- **Mobile Layout Optimization (`@media (max-width: 768px)`)**:
  - Uses a two-row header (single-line title + horizontal pill bar), shifts the active card by `-36px` so the combined `[Sleeve + Peeking Vinyl]` sits centered in the mobile viewport, and increases bottom thumbnail strip density and contrast.
- **Hotlink-Safe Thumbnail Loading**:
  - Uses `<meta name="referrer" content="no-referrer">` and `referrerpolicy="no-referrer"` so thumbnails hosted on `cloud.adhari.com` load with HTTP `200` from any origin.

| 3D Cover-Flow (Dark Mode) | 3D Cover-Flow (Light Mode) |
| :---: | :---: |
| ![Podcasts Dark](../screenshots/podcasts-coverflow-desktop.png) | ![Podcasts Light](../screenshots/podcasts-coverflow-light.png) |

| Desktop Episodes Drawer | Mobile Cover-Flow & Episodes Drawer |
| :---: | :---: |
| ![Episodes Drawer Desktop](../screenshots/podcasts-episodes-drawer.png) | ![Episodes Drawer Mobile](../screenshots/podcasts-episodes-drawer-mobile.png) |

---

## 4. Favicon & PWA Asset Pipeline (`scripts/generate-favicons.py`)

[`scripts/generate-favicons.py`](../scripts/generate-favicons.py) generates all browser and mobile home-screen icons directly from the official Radio Bahrain circular crimson-and-gold microphone emblem:
- `public/favicon.svg` — scalable vector icon
- `public/favicon.ico` — multi-resolution ICO (`16×16`, `32×32`, `48×48`)
- `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon-48x48.png`
- `public/apple-touch-icon.png` (`180×180`)
- `public/android-chrome-192x192.png`, `public/android-chrome-512x512.png`
- `public/site.webmanifest`

---

## 5. End-to-End Visual Verification (`tests/e2e.test.ts`)

[`tests/e2e.test.ts`](../tests/e2e.test.ts) runs **49 automated assertions** using `bun:test` and `puppeteer-core`:
1. **Asset, Library & Route Delivery**: Confirms HTTP `200` and expected `Content-Type` headers for all favicons, `site.webmanifest`, `/lib/gsap.js`, `/lib/hls.js`, `/podcasts`, and `/podcasts.html`.
2. **Desktop Live Player Verification (`1440×900`)**: Verifies splash dismissal, asserts `< 2px` background disc alignment, switches across all 4 stations (`Shabab 98.4`, `Bahrain 93.3`, `Shaabia 95.0`, `Holy Quran 106.1`), and captures desktop screenshots.
3. **Mobile Live Player Verification (`393×852`)**: Verifies `< 2px` artwork disc alignment on mobile viewports and captures mobile splash and player screenshots.
4. **3D Podcasts Archive Verification (`/podcasts`)**: Verifies playlist hydration, Cover-Flow navigation, active-only `.shine` opacity, desktop & mobile vinyl peek geometry, Dark & Light themes, and Desktop & Mobile episodes drawers.
