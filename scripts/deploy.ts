import { access, chmod, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stripUnnecessaryFiles } from "../build";

const DIST_DIR = "dist";
const DEFAULT_DEPLOY_TARGET = "boreal-anchor-mg6e";

function hasFlag(flag: string): boolean {
  return Bun.argv.includes(flag);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface VersionBumpResult {
  previousVersion: string;
  nextVersion: string;
  wasBumped: boolean;
}

function parseSemver(version: string): { major: number; minor: number; patch: number; prerelease: string } {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Invalid semver format: "${version}". Expected X.Y.Z`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || "",
  };
}

function incrementSemver(
  version: string,
  type: "patch" | "minor" | "major" = "patch"
): string {
  const parsed = parseSemver(version);
  if (type === "major") {
    return `${parsed.major + 1}.0.0`;
  }
  if (type === "minor") {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

async function handleVersionBump(options: {
  dryRun: boolean;
  targetVersion?: string;
  bumpType?: "patch" | "minor" | "major";
  skipBump: boolean;
}): Promise<VersionBumpResult> {
  const pkgPath = "package.json";
  const pkgRaw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(pkgRaw);
  const previousVersion = pkg.version || "1.0.0";

  if (options.skipBump) {
    console.log(`[deploy] Version bump skipped (--skip-bump). Current version: v${previousVersion}`);
    return { previousVersion, nextVersion: previousVersion, wasBumped: false };
  }

  let nextVersion: string;
  if (options.targetVersion) {
    parseSemver(options.targetVersion);
    nextVersion = options.targetVersion.replace(/^v/, "");
  } else {
    nextVersion = incrementSemver(previousVersion, options.bumpType || "patch");
  }

  if (options.dryRun) {
    console.log(`[deploy] [dry-run] Version preview: v${previousVersion} -> v${nextVersion} (package.json not modified)`);
    return { previousVersion, nextVersion, wasBumped: false };
  }

  pkg.version = nextVersion;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
  console.log(`[deploy] Automatically bumped version: v${previousVersion} -> v${nextVersion}`);

  return { previousVersion, nextVersion, wasBumped: true };
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

async function verifyAndCleanDist(): Promise<void> {
  console.log("[deploy] Verifying dist folder for unnecessary files...");
  if (!(await pathExists(DIST_DIR))) {
    throw new Error("dist folder does not exist. Build step may have failed.");
  }

  const removed = await stripUnnecessaryFiles(DIST_DIR);
  if (removed.length > 0) {
    console.log(`[deploy] 🧹 Stripped ${removed.length} unnecessary file(s) from dist:`);
    for (const file of removed) {
      console.log(`  - ${file}`);
    }
  } else {
    console.log("[deploy] ✓ Dist verified clean (no .DS_Store or unnecessary files found).");
  }
}

function getFilePermissions(filePath: string): number {
  const ext = filePath.toLowerCase();
  const scriptExtensions = [".sh", ".bash", ".zsh", ".ps1"];
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
      "Permission errors encountered. Please review production file permissions manually."
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
  const skipBump = hasFlag("--no-bump") || hasFlag("--skip-bump");
  const targetArg = Bun.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.slice("--target=".length) : DEFAULT_DEPLOY_TARGET;

  const versionArg = Bun.argv.find((arg) => arg.startsWith("--version="));
  const targetVersion = versionArg ? versionArg.slice("--version=".length) : undefined;

  const bumpArg = Bun.argv.find((arg) => arg.startsWith("--bump="));
  const bumpType = (bumpArg ? bumpArg.slice("--bump=".length) : "patch") as "patch" | "minor" | "major";

  // 1. Version incrementation
  const { nextVersion } = await handleVersionBump({
    dryRun,
    skipBump,
    targetVersion,
    bumpType,
  });

  // 2. Build project
  await runBuild();

  // 3. Run deploy migrations
  await runMigrations();

  // 4. Verify & strip unnecessary files (.DS_Store, Thumbs.db, etc.)
  await verifyAndCleanDist();

  // 5. Normalize permissions
  await fixDistPermissions();

  // 6. Push deploy
  await pushDeploy(target, dryRun);

  console.log(`[deploy] Done. Deployed v${nextVersion} to ${target}.`);
}

main().catch((error) => {
  console.error("[deploy] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
