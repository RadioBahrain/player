# Radio Bahrain Player & 3D Podcasts Archive

**[النسخة العربية (Arabic README)](./README.ar.md)** • **[Technical Overview](./docs/player-overview.md)**

A local, Bun-powered live radio player and 3D digital podcasts archive for **Radio Bahrain (إذاعة مملكة البحرين)** featuring a cinematic splash screen, real-time Web Audio visualizer, pixel-locked station artwork transitions, and an interactive 3D Cover-Flow vinyl archive.

![Radio Bahrain Live Player — Desktop Hero](screenshots/player-hero-desktop.png)

---

## Visual Tour

### 1. Live Radio Broadcast Player (`/`)

| Splash Preloader | Shabab 98.4 FM (Live Visualizer) |
| :---: | :---: |
| ![Splash Screen](screenshots/splash-screen.png) | ![Shabab 98.4 FM](screenshots/player-hero-desktop.png) |

| Bahrain FM 93.3 | Al Shaabiya 95.0 FM |
| :---: | :---: |
| ![Bahrain FM 93.3](screenshots/station-bahrain-93-3.png) | ![Al Shaabiya 95.0 FM](screenshots/station-shaabia-95-0.png) |

### 2. 3D Vinyl Podcasts Archive (`/podcasts`)

| 3D Cover-Flow Carousel & Spinning Vinyl | Interactive Episodes Drawer |
| :---: | :---: |
| ![3D Podcasts Cover-Flow](screenshots/podcasts-coverflow-desktop.png) | ![Podcasts Episodes Drawer](screenshots/podcasts-episodes-drawer.png) |

### 3. Mobile Experience (Pixel-Exact Circle Alignment)

| Mobile Splash | Mobile Live Player (`393×852`) | Mobile 3D Podcasts Archive |
| :---: | :---: | :---: |
| ![Mobile Splash](screenshots/splash-screen-mobile.png) | ![Mobile Live Player](screenshots/player-hero-mobile.png) | ![Mobile Podcasts](screenshots/podcasts-coverflow-mobile.png) |

---

## Key Features

- **Zero External CDN Runtime Dependencies**: Bundled locally with Bun (`gsap`, `hls.js`, and local `Tajawal` font weights) for self-contained, resilient playback.
- **Pixel-Locked Station Artwork Alignment**: Dynamically computes `--bg-size` and `--bg-pos` from the intrinsic station artwork (`1600×900`, disc center at `(50.1%, 41.7%)`) so the background microphone emblem aligns pixel-for-pixel behind the interactive `#btnPower` (`RADIO`) button across all desktop and mobile viewports.
- **Multi-Mode Web Audio Visualizer**: 4 visualization modes (Radial Bars, Smooth Wave, Concentric Rings, and Starfield Particles) driven by the Web Audio API `AnalyserNode`.
- **Multi-Station Live Switching**:
  - **Shabab 98.4 FM** (`شباب FM 98.4`)
  - **Bahrain 93.3 FM** (`بحرين FM 93.3`)
  - **Al Shaabiya 95.0 FM** (`الشعبية FM 95.0`)
  - **Holy Quran 106.1 FM** (`القرآن الكريم FM 106.1`)
- **YouTube Live Stream Integration**: Automatically detects and embeds `@Radio-Bahrain` live video broadcasts while coordinating audio focus.
- **3D Podcasts & Playlists Archive (`/podcasts`)**:
  - 60fps spring-interpolated 3D Cover-Flow carousel (`perspective: 1600px`, `preserve-3d`).
  - Realistic grooved vinyl disc that slides out and spins when an album is centered.
  - Mouse wheel, pointer drag, keyboard (`ArrowLeft`/`ArrowRight`), and synced thumbnail strip navigation.
  - Slide-up episodes drawer linking directly to official Radio Bahrain YouTube playlists.
  - Automatic + manual Dark (`#120204`) and Light (`#fbf7f0`) themes.
- **Complete Brand Favicon & PWA Icon Suite**: Vector `favicon.svg`, multi-resolution `favicon.ico`, Apple Touch Icon (`180×180`), Android Chrome icons (`192×192`, `512×512`), and `site.webmanifest`.

---

## Quick Start

### Install & Run Development Server

```bash
bun install
bun run dev
```

Open:
- **Live Radio Player**: `http://localhost:3000/`
- **3D Podcasts Archive**: `http://localhost:3000/podcasts`

### Production Server

```bash
bun run start
```

### Build Static Distribution (`dist/`)

```bash
bun run build
```

---

## End-to-End (E2E) Visual Testing & Screenshots

The repository includes an automated E2E visual test suite powered by `bun:test` and `puppeteer-core` (`tests/e2e.test.ts`). It spawns a local Bun server, verifies HTTP asset delivery, mathematically asserts that the background emblem disc center aligns within `< 2px` of `#btnPower` on both Desktop (`1440×900`) and Mobile (`393×852`), tests the `/podcasts` 3D Cover-Flow carousel and episodes drawer, and refreshes all documentation screenshots in `screenshots/`.

```bash
# Run the full E2E visual verification suite
bun test

# Or run the standalone screenshot generator script
bun run screenshots
```

Regenerate brand favicons from the microphone emblem at any time:

```bash
bun run favicons
```

---

## Deployment

```bash
bun run deploy
```

What `bun run deploy` performs automatically:
- Increments the patch version in `package.json` (supports `--bump=minor|major`, `--version=<custom>`, and `--skip-bump`).
- Strips OS metadata files (`.DS_Store`, `Thumbs.db`, `._*`).
- Bundles `dist/index.html`, `dist/podcasts.html`, `dist/podcasts/index.html`, and `dist/version.json`.
- Normalizes directory (`755`) and file (`644`) permissions recursively.
- Publishes to the configured HereNow target.

Validate build and packaging without uploading:

```bash
bun run deploy:dry
```

---

## Project Structure

```text
.
├── public/
│   ├── index.html              # Live Radio Player UI, Web Audio visualizer & GSAP choreography
│   ├── podcasts.html           # 3D Cover-Flow Podcasts Archive (/podcasts)
│   ├── assets/                 # Station background artwork (1600×900)
│   ├── fonts/                  # Self-hosted Tajawal Arabic/Latin font family
│   ├── favicon.svg             # Vector Radio Bahrain microphone emblem
│   ├── favicon.ico             # Multi-resolution ICO (16×16, 32×32, 48×48)
│   └── site.webmanifest        # Web App Manifest & PWA icons
├── scripts/
│   ├── capture-screenshots.ts  # Automated high-DPI screenshot capture script
│   ├── generate-favicons.py    # Brand favicon & PWA icon generator
│   └── deploy.ts               # Build, version bump, and HereNow deployment pipeline
├── tests/
│   └── e2e.test.ts             # Bun + Puppeteer E2E visual & layout alignment test suite
├── docs/
│   └── player-overview.md      # Architectural & technical overview
├── server.ts                   # Bun local HTTP server (serves /, /podcasts, /api/youtube-live)
└── build.ts                    # Static site bundler for dist/
```
