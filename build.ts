import { rm, cp, mkdir, copyFile, readFile, writeFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";

const UNNECESSARY_FILE_NAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "ehthumbs.db",
  "desktop.ini",
]);

export function isUnnecessaryFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  if (UNNECESSARY_FILE_NAMES.has(name)) return true;
  if (name.startsWith("._")) return true;
  if (name.startsWith(".git")) return true;
  if (name.endsWith(".tmp") || name.endsWith(".bak") || name.endsWith(".swp") || name.endsWith("~")) {
    return true;
  }
  return false;
}

export async function stripUnnecessaryFiles(dir: string): Promise<string[]> {
  const removed: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (isUnnecessaryFile(entry.name)) {
        await rm(fullPath, { recursive: true, force: true });
        removed.push(fullPath);
      } else if (entry.isDirectory()) {
        const subRemoved = await stripUnnecessaryFiles(fullPath);
        removed.push(...subRemoved);
      }
    }
  } catch {
    // Ignore errors if directory does not exist
  }
  return removed;
}

export async function build() {
  console.log("🧹 Cleaning dist folder...");
  await rm("dist", { recursive: true, force: true });

  // Read current version from package.json
  let version = "1.0.0";
  try {
    const pkg = JSON.parse(await readFile("package.json", "utf-8"));
    if (pkg.version) version = pkg.version;
  } catch (err) {
    console.warn("⚠️  Could not read version from package.json, defaulting to 1.0.0");
  }

  console.log("📁 Copying public assets (filtering unnecessary files)...");
  await cp("public", "dist", {
    recursive: true,
    filter: (source) => !isUnnecessaryFile(source),
  });

  console.log("📦 Copying node_modules libraries...");
  await mkdir("dist/lib", { recursive: true });
  await copyFile("node_modules/gsap/dist/gsap.js", "dist/lib/gsap.js");
  await copyFile("node_modules/hls.js/dist/hls.js", "dist/lib/hls.js");

  console.log(`📝 Updating index.html paths and embedding version v${version}...`);
  const indexPath = join("dist", "index.html");
  let html = await readFile(indexPath, "utf-8");
  html = html.replaceAll("../node_modules/gsap/dist/gsap.js", "./lib/gsap.js");
  html = html.replaceAll("../node_modules/hls.js/dist/hls.js", "./lib/hls.js");

  // Inject or update version meta tag
  const versionMetaTag = `    <meta name="version" content="${version}" />`;
  if (html.includes('<meta name="version"')) {
    html = html.replace(/<meta\s+name=["']version["']\s+content=["'][^"']*["']\s*\/?>/i, versionMetaTag.trim());
  } else {
    html = html.replace("</head>", `${versionMetaTag}\n  </head>`);
  }
  await writeFile(indexPath, html, "utf-8");

  // Write version.json manifest into dist
  const versionManifest = {
    name: "radio-bahrain-player",
    version,
    builtAt: new Date().toISOString(),
  };
  await writeFile(
    join("dist", "version.json"),
    JSON.stringify(versionManifest, null, 2) + "\n",
    "utf-8"
  );

  // Secondary sweep to ensure no unnecessary files exist in dist
  const stripped = await stripUnnecessaryFiles("dist");
  if (stripped.length > 0) {
    console.log(`🧹 Stripped ${stripped.length} unnecessary file(s) from dist: ${stripped.join(", ")}`);
  }

  console.log(`✅ Build complete! The standalone player (v${version}) is in the 'dist' folder.`);
}

if (import.meta.main) {
  build().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
}
