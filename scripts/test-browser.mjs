import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../app/src/tuning-config.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appRoot = path.join(root, "app");
const previousRef = process.env.UKETUNE_PREVIOUS_REF ?? "399a0a1";
const browserPath = process.env.UKETUNE_BROWSER_PATH
  ?? (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "google-chrome");
const previousConfiguration = execFileSync("git", ["show", `${previousRef}:app/src/tuning-config.js`], { cwd: root, encoding: "utf8" });
const previousVersion = previousConfiguration.match(/APP_VERSION = "([^"]+)"/)?.[1];
assert.ok(previousVersion, "The previous Git reference must contain a released app");
assert.notEqual(previousVersion, APP_VERSION, "Upgrade testing requires two different application versions");
const temporary = await mkdtemp(path.join(os.tmpdir(), "uketune-microphone-"));
const wavPath = path.join(temporary, "strings-and-silence.wav");
const sampleRate = 48000;
const duration = 22;
const data = Buffer.alloc(44 + sampleRate * duration * 2);
data.write("RIFF");
data.writeUInt32LE(data.length - 8, 4);
data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(sampleRate, 24);
data.writeUInt32LE(sampleRate * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(data.length - 44, 40);
const frequencies = [261.625565, 329.627557, 391.995436, 440];
for (let i = 0; i < sampleRate * duration; i += 1) {
  const frequency = frequencies[Math.floor(i / sampleRate / 4)];
  const sample = frequency ? 0.2 * Math.sin(2 * Math.PI * frequency * i / sampleRate) : 0;
  data.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}
await writeFile(wavPath, data);
const recordingPath = path.join(temporary, "C4.wav");
const recording = Buffer.from(data.subarray(0, 44 + sampleRate * 4 * 2));
recording.writeUInt32LE(recording.length - 8, 4);
recording.writeUInt32LE(recording.length - 44, 40);
await writeFile(recordingPath, recording);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, description, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      if (!/context was destroyed|Cannot find context|Inspected target navigated/i.test(error.message)) throw error;
    }
    await delay(80);
  }
  throw new Error(`Timed out: ${description}`);
}

let servePreviousVersion = true;
const previousFiles = new Map();
const mimeTypes = new Map([
  [".html", "text/html"], [".js", "text/javascript"], [".css", "text/css"],
  [".webmanifest", "application/manifest+json"], [".png", "image/png"], [".svg", "image/svg+xml"]
]);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const relativePath = pathname === "/ukulele-tuner/"
    ? "index.html"
    : pathname.startsWith("/ukulele-tuner/") ? pathname.slice("/ukulele-tuner/".length) : null;
  if (!relativePath || relativePath.split("/").some((part) => part === "..")) {
    response.writeHead(404).end();
    return;
  }
  try {
    let body;
    if (servePreviousVersion) {
      if (!previousFiles.has(relativePath)) {
        previousFiles.set(relativePath, execFileSync("git", ["show", `${previousRef}:app/${relativePath}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }));
      }
      body = previousFiles.get(relativePath);
    } else {
      body = await readFile(path.join(appRoot, relativePath));
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(relativePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const appUrl = `http://127.0.0.1:${server.address().port}/ukulele-tuner/`;
const browser = spawn(browserPath, [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-features=AudioServiceSandbox",
  "--remote-debugging-port=0",
  "--remote-allow-origins=*",
  `--user-data-dir=${path.join(temporary, "profile")}`,
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-audio-capture=${wavPath}`
], { stdio: ["ignore", "pipe", "pipe"] });
let browserLog = "";
browser.on("error", (error) => { browserLog += error.message; });
browser.stderr.on("data", (chunk) => { browserLog += chunk; });
let socket;
let getSnapshot;
const errors = [];

try {
  const port = await until(async () => {
    if (browser.exitCode !== null || browser.signalCode !== null) throw new Error(`Chrome exited: ${browserLog}`);
    try {
      return (await readFile(path.join(temporary, "profile/DevToolsActivePort"), "utf8")).split("\n")[0];
    } catch { return false; }
  }, "headless Chrome");
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(appUrl)}`, { method: "PUT" })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async (expression, userGesture = false) => {
    const result = await cdp("Runtime.evaluate", { expression, userGesture, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const click = () => evaluate("document.querySelector('#microphone-button').click()", true);
  const snapshot = () => evaluate(`({
    note: document.querySelector('#target-note').textContent,
    frequency: document.querySelector('#frequency-value').textContent,
    message: document.querySelector('#tuning-message').textContent,
    status: document.querySelector('#microphone-status').textContent,
    level: document.querySelector('#microphone-level').value,
    hidden: document.querySelector('#microphone-signal').hidden,
    running: document.querySelector('#microphone-button').dataset.running,
    button: document.querySelector('#microphone-button').textContent,
    disabled: document.querySelector('#microphone-button').disabled,
    contexts: globalThis.__ukeContexts?.map(context => context.state),
    tracks: globalThis.__ukeStreams?.flatMap(stream => stream.getTracks().map(track => track.readyState))
  })`);
  getSnapshot = snapshot;
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await until(() => evaluate(`document.querySelector('#version-label')?.textContent === ${JSON.stringify(`v${previousVersion}`)} && !!navigator.serviceWorker.controller`), "previous app and service worker");
  servePreviousVersion = false;
  await evaluate("(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); })()");
  await until(() => evaluate("!document.querySelector('#update-banner').hidden"), "new version update banner", 15000);
  await evaluate("document.querySelector('#apply-update-button').click()", true);
  await until(() => evaluate(`document.querySelector('#version-label')?.textContent === ${JSON.stringify(`v${APP_VERSION}`)} && !!navigator.serviceWorker.controller`), "apply update and reload", 15000);
  const cacheNames = await evaluate("caches.keys()");
  assert.equal(cacheNames.includes("uketune-v1"), false);
  assert.equal(cacheNames.includes("uketune-v2"), true);
  console.log(`PASS installed PWA updates from v${previousVersion} to v${APP_VERSION} and removes the previous cache`);
  await evaluate(`(() => {
    globalThis.__ukeContexts = [];
    globalThis.__ukeStreams = [];
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); __ukeContexts.push(this); }
    };
    globalThis.__ukeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await __ukeGetUserMedia(...args);
      __ukeStreams.push(stream);
      return stream;
    };
  })()`);

  await click();
  for (const [i, note] of ["C", "E", "G", "A"].entries()) {
    await until(async () => {
      const state = await snapshot();
      const cents = 1200 * Math.log2(parseFloat(state.frequency) / frequencies[i]);
      return state.note === note && Math.abs(cents) < 3 && state.message === "准了" && state.level > 0;
    }, `${note} pitch through getUserMedia and analyser`);
    console.log(`PASS live ${note}: ${JSON.stringify(await snapshot())}`);
  }
  await until(async () => (await snapshot()).status.includes("没有收到声音"), "silence diagnosis", 10000);
  assert.equal((await snapshot()).level, 0);
  console.log("PASS silence hint after the signal stops");
  await click();
  await until(async () => (await snapshot()).hidden, "stop releases capture");
  let state = await snapshot();
  assert.ok(state.contexts.every((value) => value === "closed"));
  assert.ok(state.tracks.every((value) => value === "ended"));
  console.log("PASS stop closes all audio resources");

  await click();
  await until(async () => (await snapshot()).running === "true", "restart");
  await evaluate("__ukeContexts.at(-1).suspend()", true);
  await until(async () => (await snapshot()).message.includes("音频被系统中断"), "audio interruption notification");
  state = await snapshot();
  assert.equal(state.running, "false");
  assert.equal(state.disabled, false);
  assert.ok(state.tracks.every((value) => value === "ended"));
  console.log("PASS interruption stops capture and enables retry");

  await evaluate(`navigator.mediaDevices.getUserMedia = async (...args) => {
    const stream = await __ukeGetUserMedia(...args);
    __ukeStreams.push(stream);
    await __ukeContexts.at(-1).suspend();
    return stream;
  }`);
  await click();
  await until(async () => (await snapshot()).note === "C" && (await snapshot()).running === "true", "post-permission resume");
  console.log("PASS context suspended during permission resumes and detects a string");
  await click();
  await until(async () => (await snapshot()).hidden, "stop before cancellation test");

  await evaluate("navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { globalThis.__ukeResolveCapture = resolve; })");
  await click();
  state = await snapshot();
  assert.equal(state.button, "取消麦克风启动");
  assert.equal(state.disabled, false);
  await click();
  await until(async () => (await snapshot()).button === "开始实时调音", "cancel pending permission");
  await evaluate(`(async () => {
    const stream = await __ukeGetUserMedia({audio: true});
    __ukeStreams.push(stream);
    __ukeResolveCapture(stream);
  })()`, true);
  await until(async () => (await snapshot()).tracks.every((value) => value === "ended"), "late stream cleanup");
  console.log("PASS pending permission can be cancelled and a late stream is released");

  await evaluate("navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Test denial', 'NotAllowedError'))");
  await click();
  await until(async () => (await snapshot()).message.includes("麦克风权限未开启"), "denied permission error");
  assert.equal((await snapshot()).disabled, false);
  assert.equal(await evaluate("document.querySelector('#recording-input').disabled"), false);
  console.log("PASS denied microphone permission leaves retry and recording controls usable");
  await evaluate("navigator.mediaDevices.getUserMedia = __ukeGetUserMedia");
  await click();
  await until(async () => (await snapshot()).note === "C" && (await snapshot()).running === "true", "retry after permission failure");
  await click();
  await until(async () => (await snapshot()).hidden, "stop before recording test");
  console.log("PASS retry after permission failure detects C4");

  const { root: documentRoot } = await cdp("DOM.getDocument");
  const { nodeId } = await cdp("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "#recording-input" });
  await cdp("DOM.setFileInputFiles", { nodeId, files: [recordingPath] });
  await until(() => evaluate("document.querySelector('#target-string').textContent.includes('录音') && document.querySelector('#target-note').textContent === 'C'"), "local WAV analysis");
  assert.ok(Math.abs(parseFloat((await snapshot()).frequency) - frequencies[0]) < 1);
  console.log("PASS local C4 WAV decodes and displays the matching pitch");

  await cdp("Network.enable");
  await cdp("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await cdp("Page.reload", { ignoreCache: true });
  await until(() => evaluate(`document.querySelector('#version-label')?.textContent === ${JSON.stringify(`v${APP_VERSION}`)} && document.querySelector('#connection-status').textContent === '离线' && document.querySelector('#offline-status').textContent === '可离线使用'`), "offline cached application reload", 15000);
  console.log("PASS upgraded PWA reloads fully offline with the network and local server unavailable");
  await click();
  await until(async () => (await snapshot()).note === "C" && (await snapshot()).running === "true", "offline microphone recognition");
  console.log("PASS offline simulated microphone input still detects C4");

  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true);
  const screenshot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  const screenshotPath = path.join(temporary, "microphone-smoke.png");
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  console.log(`PASS no uncaught browser errors; mobile layout fits; screenshot: ${screenshotPath}`);
} catch (error) {
  console.error(error);
  if (getSnapshot) console.error(`Page: ${JSON.stringify(await getSnapshot())}`);
  console.error(`Chrome: ${browserLog.slice(-3000)}`);
  process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  browser.stdout.destroy();
  browser.stderr.destroy();
  server.closeAllConnections();
  server.close();
}
