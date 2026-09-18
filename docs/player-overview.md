# Radio Bahrain player overview

This app plays Bahrain radio streams with a premium presentation layer and self-contained asset setup. All required runtime libraries are installed with Bun and served locally from the project, which removes the need for external dependency downloads during runtime.

## Main behaviors

- splash preloader with a dedicated start button before audio is unlocked
- channel switching with matching local image backgrounds
- smooth transmission-style background transitions using layered CSS and GSAP animations
- live waveform visualization created from the Web Audio API
- Bun-powered local static server for project hosting

## Local runtime setup

```bash
bun install
bun run start
```

Then open:

http://localhost:3000

## Assets

The project uses the local image files in `public/assets/` to match each channel with a distinct visual identity.
