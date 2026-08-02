import { analyzeAudioFile, AudioFileAnalysisError } from "./src/audio-file-analyzer.js";
import { MicrophoneSource } from "./src/microphone-source.js";
import { TunerController } from "./src/tuner-controller.js";
import { APP_VERSION, findTargetByNote } from "./src/tuning-config.js";
import { YinPitchDetector } from "./src/yin-pitch-detector.js";

const elements = {
  tunerCard: document.querySelector("#tuner-card"),
  targetString: document.querySelector("#target-string"),
  targetNote: document.querySelector("#target-note"),
  frequencyValue: document.querySelector("#frequency-value"),
  tuningMeter: document.querySelector("#tuning-meter"),
  centsValue: document.querySelector("#cents-value"),
  tuningMessage: document.querySelector("#tuning-message"),
  targetButtons: [...document.querySelectorAll(".target-button")],
  microphoneButton: document.querySelector("#microphone-button"),
  recordingLabel: document.querySelector("#recording-label"),
  recordingInput: document.querySelector("#recording-input"),
  analysisStatus: document.querySelector("#analysis-status"),
  fileStatus: document.querySelector("#file-status"),
  progressValue: document.querySelector("#progress-value"),
  analysisProgress: document.querySelector("#analysis-progress"),
  cancelAnalysisButton: document.querySelector("#cancel-analysis-button"),
  connectionStatus: document.querySelector("#connection-status"),
  offlineStatus: document.querySelector("#offline-status"),
  installInstructions: document.querySelector("#install-instructions"),
  updateBanner: document.querySelector("#update-banner"),
  applyUpdateButton: document.querySelector("#apply-update-button"),
  versionLabel: document.querySelector("#version-label")
};

const detector = new YinPitchDetector();
const controller = new TunerController({ detector });
let selectedTargetNote = null;
let liveResultVisible = false;
let analysisAbortController = null;
let waitingServiceWorker = null;
let reloadForUpdate = false;

const microphone = new MicrophoneSource({
  onFrame(samples, sampleRateHz, timestampMs) {
    const outcome = controller.processSamples(samples, sampleRateHz, timestampMs);
    handleLiveOutcome(outcome);
  }
});

initialize();

function initialize() {
  elements.versionLabel.textContent = `v${APP_VERSION}`;
  bindControls();
  updateConnectionStatus();
  updateInstallInstructions();
  renderReadyState();
  registerServiceWorker();
}

function bindControls() {
  for (const button of elements.targetButtons) {
    button.addEventListener("click", () => {
      selectedTargetNote = button.dataset.targetNote || null;
      controller.setLockedTarget(selectedTargetNote);
      liveResultVisible = false;

      for (const targetButton of elements.targetButtons) {
        const selected = targetButton === button;
        targetButton.classList.toggle("is-selected", selected);
        targetButton.setAttribute("aria-pressed", String(selected));
      }

      renderReadyState(
        microphone.isRunning ? "请拨动所选琴弦" : "目标弦已选择，可以开始调音"
      );
    });
  }

  elements.microphoneButton.addEventListener("click", handleMicrophoneButton);
  elements.recordingInput.addEventListener("change", handleRecordingSelection);
  elements.recordingLabel.addEventListener("click", (event) => {
    if (elements.recordingLabel.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
    }
  });
  elements.cancelAnalysisButton.addEventListener("click", cancelFileAnalysis);
  elements.applyUpdateButton.addEventListener("click", applyServiceWorkerUpdate);

  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  window.addEventListener("pagehide", () => {
    if (microphone.isRunning || microphone.isStarting) {
      void stopMicrophone({ message: "实时调音已暂停，点按钮可重新开始" });
    }
    cancelFileAnalysis({ render: false });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden"
        && (microphone.isRunning || microphone.isStarting)) {
      void stopMicrophone({ message: "实时调音已暂停，点按钮可重新开始" });
    }
  });
}

async function handleMicrophoneButton() {
  if (microphone.isRunning) {
    await stopMicrophone();
    return;
  }

  cancelFileAnalysis({ render: false });
  controller.resetSignal();
  liveResultVisible = false;
  setInputControlsBusy(true);
  elements.microphoneButton.textContent = "正在请求麦克风…";
  renderReadyState("请允许麦克风权限，然后一次拨一根弦");

  try {
    await microphone.start();
    if (!microphone.isRunning) {
      elements.microphoneButton.dataset.running = "false";
      elements.microphoneButton.textContent = "开始实时调音";
      renderReadyState("实时调音已暂停，点按钮可重新开始");
      return;
    }
    elements.microphoneButton.dataset.running = "true";
    elements.microphoneButton.textContent = "停止实时调音";
    renderReadyState("正在听，请拨动一根弦");
  } catch (error) {
    elements.microphoneButton.dataset.running = "false";
    elements.microphoneButton.textContent = "开始实时调音";
    renderError(microphoneErrorMessage(error));
  } finally {
    setInputControlsBusy(false);
  }
}

async function stopMicrophone({ message = "实时调音已停止" } = {}) {
  setInputControlsBusy(true);
  try {
    await microphone.stop();
    controller.resetSignal();
    liveResultVisible = false;
    elements.microphoneButton.dataset.running = "false";
    elements.microphoneButton.textContent = "开始实时调音";
    renderReadyState(message);
  } finally {
    setInputControlsBusy(false);
  }
}

function handleLiveOutcome(outcome) {
  if (!outcome) {
    return;
  }

  if (outcome.kind === "result") {
    liveResultVisible = true;
    renderTuningResult(outcome.result, { source: "microphone" });
    return;
  }

  if (outcome.kind === "expired") {
    liveResultVisible = false;
    renderReadyState("声音已停止，请再次拨弦");
    return;
  }

  if (outcome.kind === "stabilizing" && !liveResultVisible) {
    renderReadyState("正在稳定音高…");
    return;
  }

  if ((outcome.kind === "no-signal" || outcome.kind === "uncertain")
      && !liveResultVisible) {
    renderReadyState("正在听，请清晰地拨动一根弦");
  }
}

async function handleRecordingSelection() {
  const file = elements.recordingInput.files?.[0];
  if (!file) {
    return;
  }

  if (microphone.isRunning) {
    await stopMicrophone({ message: "正在切换到录音分析…" });
  }

  const abortController = new AbortController();
  analysisAbortController = abortController;
  showFileAnalysisProgress(file.name, 0);
  setInputControlsBusy(true, { allowCancel: true });
  liveResultVisible = false;
  renderReadyState("正在本机分析录音，请稍候…");

  try {
    const analysis = await analyzeAudioFile(file, {
      detector,
      lockedTargetNote: selectedTargetNote,
      signal: abortController.signal,
      onProgress(progress) {
        if (analysisAbortController === abortController) {
          showFileAnalysisProgress(file.name, progress);
        }
      }
    });

    if (analysisAbortController !== abortController) {
      return;
    }
    renderTuningResult(analysis.result, {
      source: "file",
      durationSeconds: analysis.durationSeconds
    });
  } catch (error) {
    if (analysisAbortController !== abortController) {
      return;
    }
    if (error instanceof AudioFileAnalysisError && error.code === "aborted") {
      renderReadyState("录音分析已取消");
    } else {
      renderError(fileAnalysisErrorMessage(error));
    }
  } finally {
    if (analysisAbortController === abortController) {
      analysisAbortController = null;
      elements.analysisStatus.hidden = true;
      elements.recordingInput.value = "";
      setInputControlsBusy(false);
    }
  }
}

function cancelFileAnalysis({ render = true } = {}) {
  if (!analysisAbortController) {
    return;
  }
  analysisAbortController.abort();
  analysisAbortController = null;
  elements.analysisStatus.hidden = true;
  elements.recordingInput.value = "";
  setInputControlsBusy(false);
  if (render) {
    renderReadyState("录音分析已取消");
  }
}

function showFileAnalysisProgress(fileName, progress) {
  const normalizedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const percentage = Math.round(normalizedProgress * 100);
  elements.analysisStatus.hidden = false;
  elements.fileStatus.textContent = `正在分析 ${shortenFileName(fileName)}`;
  elements.progressValue.textContent = `${percentage}%`;
  elements.analysisProgress.value = normalizedProgress;
  elements.analysisProgress.textContent = `${percentage}%`;
}

function setInputControlsBusy(busy, { allowCancel = false } = {}) {
  elements.microphoneButton.disabled = busy;
  elements.recordingInput.disabled = busy;
  elements.recordingLabel.setAttribute("aria-disabled", String(busy));
  elements.cancelAnalysisButton.disabled = !allowCancel;
  for (const targetButton of elements.targetButtons) {
    targetButton.disabled = busy;
  }
}

function renderReadyState(message = "选择一种方式开始调音") {
  const target = findTargetByNote(selectedTargetNote);
  elements.tunerCard.dataset.state = "idle";
  elements.targetString.textContent = target ? `第 ${target.position} 弦` : "自动识别";
  elements.targetNote.textContent = target?.label ?? "—";
  elements.frequencyValue.textContent = target
    ? `目标 ${target.frequencyHz.toFixed(1)} Hz`
    : "等待声音";
  elements.tuningMeter.value = "0";
  elements.tuningMeter.setAttribute("aria-valuenow", "0");
  elements.centsValue.textContent = "— cents";
  elements.tuningMessage.textContent = message;
}

function renderTuningResult(result, { source, durationSeconds = null }) {
  const cents = Math.max(-50, Math.min(50, result.cents));
  const roundedCents = Math.round(result.cents * 10) / 10;
  const sourceDescription = source === "file"
    ? `录音 ${durationSeconds.toFixed(1)} 秒`
    : "实时麦克风";

  elements.tunerCard.dataset.state = result.direction;
  elements.targetString.textContent = `第 ${result.target.position} 弦 · ${sourceDescription}`;
  elements.targetNote.textContent = result.target.label;
  elements.frequencyValue.textContent = `${result.detectedFrequencyHz.toFixed(1)} Hz`;
  elements.tuningMeter.value = String(cents);
  elements.tuningMeter.setAttribute("aria-valuenow", String(roundedCents));
  elements.centsValue.textContent = `${formatSignedNumber(roundedCents)} cents`;
  elements.tuningMessage.textContent = tuningMessage(result.direction, source);
}

function renderError(message) {
  elements.tunerCard.dataset.state = "error";
  elements.targetString.textContent = "需要处理";
  elements.targetNote.textContent = "!";
  elements.frequencyValue.textContent = "未检测到有效音高";
  elements.tuningMeter.value = "0";
  elements.tuningMeter.setAttribute("aria-valuenow", "0");
  elements.centsValue.textContent = "— cents";
  elements.tuningMessage.textContent = message;
}

function tuningMessage(direction, source) {
  const suffix = source === "file" ? "（录音结果）" : "";
  switch (direction) {
    case "too-low":
      return `音高偏低，请升高${suffix}`;
    case "too-high":
      return `音高偏高，请降低${suffix}`;
    case "in-tune":
      return `准了${suffix}`;
    default:
      return "请重新拨弦";
  }
}

function microphoneErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "麦克风权限未开启。可在 iPhone 设置中允许，或直接选择录音分析。";
    case "NotFoundError":
      return "没有找到可用麦克风，请改用录音分析。";
    case "NotReadableError":
      return "麦克风暂时被占用。请关闭其他录音应用后重试，或选择录音分析。";
    case "NotSupportedError":
      return "当前打开方式不支持麦克风。请用 Safari 的 HTTPS 页面，或选择录音分析。";
    default:
      return "麦克风启动失败。可重新打开应用再试，或选择录音分析。";
  }
}

function fileAnalysisErrorMessage(error) {
  if (error instanceof AudioFileAnalysisError) {
    return error.message;
  }
  return "录音分析失败。请换一个 2–10 秒的 M4A、MP3 或 WAV 文件。";
}

function formatSignedNumber(value) {
  if (Object.is(value, -0) || value === 0) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

function shortenFileName(fileName) {
  return fileName.length <= 24 ? fileName : `${fileName.slice(0, 20)}…`;
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  elements.connectionStatus.dataset.status = online ? "online" : "offline";
  elements.connectionStatus.textContent = online ? "在线" : "离线";
}

function updateInstallInstructions() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
  elements.installInstructions.hidden = standalone;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    elements.offlineStatus.dataset.status = "unsupported";
    elements.offlineStatus.textContent = "不支持离线";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    watchServiceWorkerRegistration(registration);
    await navigator.serviceWorker.ready;
    elements.offlineStatus.dataset.status = "ready";
    elements.offlineStatus.textContent = "可离线使用";
  } catch {
    elements.offlineStatus.dataset.status = "error";
    elements.offlineStatus.textContent = "离线未就绪";
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadForUpdate) {
      window.location.reload();
    }
  });
}

function watchServiceWorkerRegistration(registration) {
  if (registration.waiting) {
    showServiceWorkerUpdate(registration.waiting);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    installingWorker?.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        showServiceWorkerUpdate(installingWorker);
      }
    });
  });
}

function showServiceWorkerUpdate(worker) {
  waitingServiceWorker = worker;
  elements.updateBanner.hidden = false;
}

function applyServiceWorkerUpdate() {
  if (!waitingServiceWorker) {
    return;
  }
  reloadForUpdate = true;
  elements.applyUpdateButton.disabled = true;
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}
