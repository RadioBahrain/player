# Radio Bahrain Player — Technical & Architectural Overview

This document explains the runtime architecture, visual alignment math, route structure, and automated verification setup for the **Radio Bahrain Player** repository.

![Radio Bahrain Player Hero]( ../screenshots/player-hero-desktop.png )

---

## 1. Runtime & Bundling Architecture

The project is built and served exclusively with **Bun**:
- **Local Development & Production Server ([`server.ts`](../server.ts))**:
  - Serves `public/index.html` at `/`.
  - Serves `public/podcasts.html` at `/podcasts` and `/podcasts/` (extensionless route normalization).
  - Provides `/api/youtube-live` to check whether `@Radio-Bahrain` (`UCylIWXb8bRI0KcDeJG6H8rw`) has an active YouTube live stream and returns its video metadata.
  - Maps `/node_modules/*` requests so local browser imports of `gsap` and `hls.js` work without external CDN calls.
- **Static Build Pipeline ([`build.ts`](../build.ts))**:
  - Copies `public/` into `dist/`.
  - Copies `gsap.js` and `hls.js` into `dist/vendor/` and rewrites script paths in both `dist/index.html` and `dist/podcasts.html`.
  - Generates `dist/podcasts/index.html` alongside `dist/podcasts.html` so static hosts resolve `/podcasts` cleanly without server-side rewrites.
  - Injects the release version from `package.json` into `dist/index.html` and emits `dist/version.json`.

---

## 2. Pixel-Locked Background Artwork Alignment (`public/index.html`)

Each station background image in `public/assets/` (`1600×900`) contains a central circular red microphone emblem whose intrinsic coordinates are measured at:
- Horizontal center: `discCx = 0.501` (`801.6px` of `1600px`)
- Vertical center: `discCy = 0.417` (`375.3px` of `900px`)
- Intrinsic diameter: `discDiameter = 0.252` of image width (`403.2px` of `1600px`)

### Why Standard CSS `background-size: cover` Drifts on Mobile
On a narrow portrait viewport (e.g., `393×852`), CSS `background-size: cover` scales the image to match the viewport height (`852px`), making the rendered image `1514.67px` wide and the background emblem disc `381.7px` in diameter, whereas the foreground `#btnPower` (`RADIO`) button is clamped at `clamp(210px, 58vw, 290px)` (`227.94px`). Furthermore, pinning `50.1% 41.7%` via percentage `background-position` only works when using percentage offset math relative to `(viewportSize - imageSize)`, causing vertical and radial drift on mobile screens.

### Exact Coordinate Solver
`syncBackgroundFocusToAnchor()` in [`public/index.html`](../public/index.html) computes explicit pixel values for `--bg-size` and `--bg-pos`:
1. Measures the live bounding box of `#btnPower` (or `#splashLogo` while the splash screen is visible).
2. Calculates the minimum scale factor so the background image covers the viewport (`scaleCover`) **and** matches the foreground button diameter (`scaleMatchBtn = anchorDiameter / (1600 * 0.252)`).
3. Sets `--bg-size: <bgW>px <bgH>px` and positions the top-left corner at:
   - `left = centerX - 0.501 * bgW`
   - `top = centerY - 0.417 * bgH`
4. Updates continuously during the GSAP entrance timeline (`entranceTl`) and on `ResizeObserver` / `visualViewport` events.

| Desktop Alignment (`1440×900`) | Mobile Alignment (`393×852`) |
| :---: | :---: |
| ![Desktop Alignment](../screenshots/player-hero-desktop.png) | ![Mobile Alignment](../screenshots/player-hero-mobile.png) |

---

## 3. 3D Vinyl Podcasts Archive (`public/podcasts.html`)

Accessible at `/podcasts` (via the top navigation bar's podcast icon button on the live player), [`public/podcasts.html`](../public/podcasts.html) provides an interactive 3D Cover-Flow browser for Radio Bahrain's digital podcast and YouTube playlist archive:
- **60fps Spring Physics**: A GSAP ticker interpolates `currentPos += (targetIdx - currentPos) * 0.12` and applies continuous 3D transforms (`translate3d`, `rotateY`, `scale`) to each `.slide`.
- **Realistic Grooved Vinyl Disc**: When `Math.abs(offset) < 0.45`, the `.sleeve` gains `.active` and the `.vinyl` disc translates `-58%` horizontally while spinning continuously (`@keyframes spin`).
- **Hotlink-Safe Thumbnail Loading**: Uses `<meta name="referrer" content="no-referrer">` and `referrerpolicy="no-referrer"` so thumbnails hosted on `cloud.adhari.com` render without triggering Cloudflare Referer hotlink protection when served from `localhost` or production domains.
- **Episodes Drawer**: Clicking the active album opens a slide-up glassmorphism drawer (`#episodesPanel`) displaying all episodes in the selected playlist.

![3D Podcasts Cover-Flow](../screenshots/podcasts-coverflow-desktop.png)

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

[`tests/e2e.test.ts`](../tests/e2e.test.ts) runs automated browser checks using `bun:test` and `puppeteer-core`:
1. **Favicon & Manifest Verification**: Confirms HTTP `200` and expected `Content-Type` headers for all icon and manifest endpoints.
2. **Desktop Live Player Verification (`1440×900`)**: Verifies splash screen dismissal, asserts background disc center alignment (`dx < 2px`, `dy < 2px`), tests channel switching (`Shabab 98.4`, `Bahrain 93.3`, `Shaabia 95.0`), and captures desktop screenshots.
3. **Mobile Live Player Verification (`393×852`)**: Verifies that the intrinsic artwork disc center (`bgLeft + 0.501 * bgW`, `bgTop + 0.417 * bgH`) aligns within `< 2px` of `#btnPower` on mobile and captures mobile screenshots.
4. **3D Podcasts Archive Verification (`/podcasts`)**: Verifies playlist loading, Cover-Flow carousel navigation, image natural width (`naturalWidth > 100`), episodes drawer opening/closing, and captures desktop and mobile `/podcasts` screenshots.
