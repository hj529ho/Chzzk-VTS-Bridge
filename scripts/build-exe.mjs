import { execSync } from "node:child_process";
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const RELEASE = path.join(ROOT, "release");

// 1. Type check
console.log("[1/4] Type checking...");
execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "inherit" });

// 2. esbuild bundle (ESM → CJS single file)
console.log("[2/4] Bundling with esbuild...");
await build({
  entryPoints: [path.join(ROOT, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(DIST, "bundle.cjs"),
  define: {
    "import.meta.url": "importMetaUrl",
  },
  banner: {
    js: `const importMetaUrl = require("url").pathToFileURL(__filename).href;`,
  },
  external: [],
  sourcemap: false,
  minify: false,
});

// 3. pkg → exe
console.log("[3/4] Creating exe with pkg...");
if (!fs.existsSync(RELEASE)) fs.mkdirSync(RELEASE, { recursive: true });
execSync(
  `npx pkg "${path.join(DIST, "bundle.cjs")}" --targets node20-win-x64 --output "${path.join(RELEASE, "chzzk-vts-bridge.exe")}"`,
  { cwd: ROOT, stdio: "inherit" },
);

// 4. Copy static files next to exe
console.log("[4/4] Copying static files...");
const staticSrc = path.join(ROOT, "src/server/static");
const staticDst = path.join(RELEASE, "static");
if (fs.existsSync(staticDst)) fs.rmSync(staticDst, { recursive: true });
fs.mkdirSync(staticDst, { recursive: true });
for (const file of fs.readdirSync(staticSrc)) {
  fs.copyFileSync(path.join(staticSrc, file), path.join(staticDst, file));
}

const exe = path.join(RELEASE, "chzzk-vts-bridge.exe");
if (fs.existsSync(exe)) {
  const size = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone! Output in release/ folder:`);
  console.log(`  ${exe} (${size} MB)`);
  console.log(`  ${staticDst}/  (dashboard files)`);
  console.log(`\nZip the release/ folder to distribute.`);
} else {
  console.error("Failed to create exe");
  process.exit(1);
}
