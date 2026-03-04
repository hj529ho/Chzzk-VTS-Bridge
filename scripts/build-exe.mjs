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
  // import.meta.url 를 CJS 호환으로 변환
  define: {
    "import.meta.url": "importMetaUrl",
  },
  banner: {
    js: `const importMetaUrl = require("url").pathToFileURL(__filename).href;`,
  },
  // static 파일은 별도 복사하므로 번들에서 제외할 것 없음
  external: [],
  sourcemap: false,
  minify: false,
});

// 3. Copy static files next to bundle
console.log("[3/4] Copying static files...");
const staticSrc = path.join(ROOT, "src/server/static");
const staticDst = path.join(DIST, "static");
if (fs.existsSync(staticDst)) fs.rmSync(staticDst, { recursive: true });
fs.mkdirSync(staticDst, { recursive: true });
for (const file of fs.readdirSync(staticSrc)) {
  fs.copyFileSync(path.join(staticSrc, file), path.join(staticDst, file));
}

// 4. pkg → exe
console.log("[4/4] Creating exe with pkg...");
if (!fs.existsSync(RELEASE)) fs.mkdirSync(RELEASE, { recursive: true });
execSync(
  `npx pkg "${path.join(DIST, "bundle.cjs")}" --targets node20-win-x64 --output "${path.join(RELEASE, "chzzk-vts-bridge.exe")}" --assets "${staticDst}/**/*"`,
  { cwd: ROOT, stdio: "inherit" },
);

const exe = path.join(RELEASE, "chzzk-vts-bridge.exe");
if (fs.existsSync(exe)) {
  const size = (fs.statSync(exe).size / 1024 / 1024).toFixed(1);
  console.log(`\nDone! ${exe} (${size} MB)`);
} else {
  console.error("Failed to create exe");
  process.exit(1);
}
