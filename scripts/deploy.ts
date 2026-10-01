import { access, chmod, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIST_DIR = "dist";
const DEFAULT_DEPLOY_TARGET = "boreal-anchor-mg6e";

function hasFlag(flag: string) {
  return Bun.argv.includes(flag);
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runBuild() {
  console.log("[deploy] Building project...");
  await Bun.$`bun run build`;
}

async function migrateDistHtml(indexPath: string) {
  let html = await readFile(indexPath, "utf-8");
  const original = html;

  // Keep compatibility if any stale build artifact still points to node_modules.
  html = html.replaceAll("../node_modules/gsap/dist/gsap.js", "./lib/gsap.js");
  html = html.replaceAll("../node_modules/hls.js/dist/hls.js", "./lib/hls.js");

  if (html !== original) {
    await writeFile(indexPath, html, "utf-8");
    console.log("[deploy] Migrated stale script paths in dist/index.html");
  }
}

async function runMigrations() {
  console.log("[deploy] Running deploy migrations...");
  const indexPath = join(DIST_DIR, "index.html");
  if (await pathExists(indexPath)) {
    await migrateDistHtml(indexPath);
  }
}

function getFilePermissions(filePath: string): number {
  const ext = filePath.toLowerCase();
  const scriptExtensions = ['.sh', '.bash', '.zsh', '.ps1'];
  const isScript = scriptExtensions.some((e) => ext.endsWith(e));
  return isScript ? 0o755 : 0o644;
}

async function applyPermissionsRecursive(
  targetPath: string,
  stats: { changed: number; skipped: number; errors: string[] } = { changed: 0, skipped: 0, errors: [] }
): Promise<typeof stats> {
  try {
    const entryStat = await stat(targetPath);

    if (entryStat.isSymbolicLink()) {
      stats.skipped++;
      return stats;
    }

    if (entryStat.isDirectory()) {
      const targetMode = 0o755;
      const currentMode = entryStat.mode & 0o777;

      if (currentMode !== targetMode) {
        try {
          await chmod(targetPath, targetMode);
          stats.changed++;
        } catch (error) {
          const msg = `Failed to chmod directory ${targetPath}: ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(msg);
        }
      }

      const entries = await readdir(targetPath);
      for (const entry of entries) {
        await applyPermissionsRecursive(join(targetPath, entry), stats);
      }
      return stats;
    }

    const targetMode = getFilePermissions(targetPath);
    const currentMode = entryStat.mode & 0o777;

    if (currentMode !== targetMode) {
      try {
        await chmod(targetPath, targetMode);
        stats.changed++;
      } catch (error) {
        const msg = `Failed to chmod file ${targetPath}: ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(msg);
      }
    } else {
      stats.skipped++;
    }
  } catch (error) {
    const msg = `Failed to stat ${targetPath}: ${error instanceof Error ? error.message : String(error)}`;
    stats.errors.push(msg);
  }

  return stats;
}

async function fixDistPermissions() {
  console.log("[deploy] Normalizing dist permissions (dirs 755, files 644, scripts 755)...");
  if (!(await pathExists(DIST_DIR))) {
    throw new Error("dist folder does not exist. Build step may have failed.");
  }

  const stats = await applyPermissionsRecursive(DIST_DIR);

  if (stats.errors.length > 0) {
    console.warn(`[deploy] ⚠️  Permission warnings (${stats.errors.length}):`);
    stats.errors.forEach((error) => console.warn(`  - ${error}`));
  }

  console.log(
    `[deploy] ✓ Permissions applied: ${stats.changed} changed, ${stats.skipped} already correct`
  );

  if (stats.errors.length > 0) {
    throw new Error(
      `Permission errors encountered. Please review production file permissions manually.`
    );
  }
}

async function pushDeploy(target: string, dryRun: boolean) {
  if (dryRun) {
    console.log(`[deploy] Dry run enabled. Skipping upload to ${target}.`);
    return;
  }

  console.log(`[deploy] Uploading ${DIST_DIR} to ${target}...`);
  await Bun.$`bunx herenowcli update ${target} ${DIST_DIR}`;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const targetArg = Bun.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.slice("--target=".length) : DEFAULT_DEPLOY_TARGET;

  await runBuild();
  await runMigrations();
  await fixDistPermissions();
  await pushDeploy(target, dryRun);

  console.log("[deploy] Done.");
}

main().catch((error) => {
  console.error("[deploy] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
