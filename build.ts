import { rm, cp, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function build() {
  console.log("🧹 Cleaning dist folder...");
  await rm("dist", { recursive: true, force: true });

  console.log("📁 Copying public assets...");
  await cp("public", "dist", { recursive: true });

  console.log("📦 Copying node_modules libraries...");
  await mkdir("dist/lib", { recursive: true });
  await copyFile("node_modules/gsap/dist/gsap.js", "dist/lib/gsap.js");
  await copyFile("node_modules/hls.js/dist/hls.js", "dist/lib/hls.js");

  console.log("📝 Updating index.html paths...");
  const indexPath = join("dist", "index.html");
  let html = await readFile(indexPath, "utf-8");
  html = html.replace("../node_modules/gsap/dist/gsap.js", "./lib/gsap.js");
  html = html.replace("../node_modules/hls.js/dist/hls.js", "./lib/hls.js");
  await writeFile(indexPath, html, "utf-8");

  console.log("✅ Build complete! The standalone player is in the 'dist' folder.");
}

build().catch(console.error);
