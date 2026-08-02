import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(scriptDirectory);
const appRoot = path.join(projectRoot, "app");

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "src/tuning-config.js",
  "src/tuning-math.js",
  "src/yin-pitch-detector.js",
  "src/pitch-stabilizer.js",
  "src/microphone-source.js",
  "src/audio-file-analyzer.js",
  "src/tuner-controller.js"
];

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectJavaScriptFiles(entryPath);
    }
    return entry.name.endsWith(".js") ? [entryPath] : [];
  }));
  return nested.flat();
}

for (const relativePath of requiredFiles) {
  const fileStats = await stat(path.join(appRoot, relativePath));
  assert.equal(fileStats.isFile(), true, `Missing required file: ${relativePath}`);
}

for (const size of [180, 192, 512]) {
  const icon = await readFile(path.join(appRoot, `icons/icon-${size}.png`));
  assert.equal(icon.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(icon.readUInt32BE(16), size, `icon-${size}.png has the wrong width`);
  assert.equal(icon.readUInt32BE(20), size, `icon-${size}.png has the wrong height`);
}

const manifest = JSON.parse(await readFile(path.join(appRoot, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(manifest.display, "standalone");
assert.match(manifest.orientation, /^portrait/);
assert.equal(Array.isArray(manifest.icons), true);
assert.equal(manifest.icons.some((icon) => icon.sizes === "192x192"), true);
assert.equal(manifest.icons.some((icon) => icon.sizes === "512x512"), true);

const serviceWorker = await readFile(path.join(appRoot, "sw.js"), "utf8");
assert.match(serviceWorker, /const CACHE_VERSION = "uketune-v\d+"/);
for (const relativePath of requiredFiles) {
  assert.equal(
    serviceWorker.includes(`./${relativePath}`),
    true,
    `Service worker app shell is missing: ${relativePath}`
  );
}

const indexHtml = await readFile(path.join(appRoot, "index.html"), "utf8");
assert.match(indexHtml, /Content-Security-Policy/);
assert.match(indexHtml, /manifest\.webmanifest/);
assert.match(indexHtml, /apple-touch-icon/);
assert.doesNotMatch(indexHtml, /<script[^>]+https?:\/\//i);
assert.match(indexHtml, /form-action 'none'/);

const runtimeJavaScriptFiles = (await collectJavaScriptFiles(appRoot))
  .filter((file) => path.basename(file) !== "sw.js");
for (const runtimeFile of runtimeJavaScriptFiles) {
  const source = await readFile(runtimeFile, "utf8");
  assert.doesNotMatch(
    source,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*\(/,
    `Runtime network API is not allowed in ${path.relative(appRoot, runtimeFile)}`
  );
}

for (const javaScriptFile of await collectJavaScriptFiles(appRoot)) {
  execFileSync(process.execPath, ["--check", javaScriptFile], { stdio: "inherit" });
}

console.log("Static checks passed");
