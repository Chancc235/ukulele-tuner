function stopTracks(stream) {
  for (const track of stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {
      // Continue releasing the other tracks if one has already ended.
    }
  }
}

async function waitForStartup(operation, signal, timeoutMs = null) {
  let timer;
  let onAbort;
  try {
    return await new Promise((resolve, reject) => {
      Promise.resolve(operation).then(resolve, reject);
      onAbort = () => reject(new DOMException("Microphone startup cancelled", "AbortError"));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) {
        onAbort();
      } else if (timeoutMs !== null) {
        timer = setTimeout(() => {
          reject(new DOMException("Audio engine did not resume", "TimeoutError"));
        }, timeoutMs);
      }
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

export class MicrophoneSource {
  constructor({
    onFrame,
    onError = () => {},
    analysisIntervalMs = 50,
    fftSize = 4096,
    startupTimeoutMs = 8000,
    environment = globalThis
  }) {
    if (typeof onFrame !== "function") {
      throw new TypeError("onFrame callback is required");
    }
    if (typeof onError !== "function") {
      throw new TypeError("onError callback must be a function");
    }
    if (!Number.isFinite(startupTimeoutMs) || startupTimeoutMs <= 0) {
      throw new RangeError("startupTimeoutMs must be positive");
    }
    if (!Number.isFinite(analysisIntervalMs) || analysisIntervalMs <= 0) {
      throw new RangeError("analysisIntervalMs must be positive");
    }
    if (!Number.isInteger(fftSize) || fftSize < 32 || (fftSize & (fftSize - 1)) !== 0) {
      throw new RangeError("fftSize must be a power of two");
    }

    this.onFrame = onFrame;
    this.onError = onError;
    this.analysisIntervalMs = analysisIntervalMs;
    this.fftSize = fftSize;
    this.startupTimeoutMs = startupTimeoutMs;
    this.environment = environment;
    this.generation = 0;
    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.animationFrameId = null;
    this.samples = null;
    this.lastAnalysisAtMs = Number.NEGATIVE_INFINITY;
    this.lastContextTimeSeconds = null;
    this.lastContextProgressAtMs = null;
    this.mutedAtMs = null;
    this.running = false;
    this.starting = false;
    this.startupAbortController = null;
    this.removeListeners = [];
  }

  get isRunning() {
    return this.running;
  }

  get isStarting() {
    return this.starting;
  }

  async start() {
    if (this.running || this.starting) {
      return;
    }

    const mediaDevices = this.environment.navigator?.mediaDevices;
    const AudioContextConstructor = this.environment.AudioContext
      ?? this.environment.webkitAudioContext;
    if (!mediaDevices?.getUserMedia || !AudioContextConstructor) {
      throw new DOMException("This browser does not support microphone capture", "NotSupportedError");
    }

    const token = this.generation + 1;
    this.generation = token;
    this.starting = true;
    const abortController = new AbortController();
    this.startupAbortController = abortController;

    try {
      const context = new AudioContextConstructor({ latencyHint: "interactive" });
      this.audioContext = context;
      if (context.state !== "running") {
        // Unlock inside the click handler, but do not block the permission
        // request on Safari's potentially unresolved resume() promise.
        context.resume().catch(() => {});
      }

      const capture = mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false }
        },
        video: false
      }).then((stream) => {
        if (token !== this.generation) {
          stopTracks(stream);
        }
        return stream;
      });
      const stream = await waitForStartup(capture, abortController.signal);
      if (token !== this.generation) {
        stopTracks(stream);
        return;
      }

      this.stream = stream;
      this.sourceNode = context.createMediaStreamSource(stream);
      this.analyserNode = context.createAnalyser();
      this.analyserNode.fftSize = this.fftSize;
      this.analyserNode.smoothingTimeConstant = 0;
      this.samples = new Float32Array(this.analyserNode.fftSize);
      this.sourceNode.connect(this.analyserNode);

      // Granting capture permission can change the iOS audio session and
      // interrupt a context that was already running before the prompt.
      if (context.state !== "running") {
        await waitForStartup(context.resume(), abortController.signal, this.startupTimeoutMs);
      }
      if (token !== this.generation) {
        return;
      }
      if (context.state !== "running") {
        throw new DOMException("Audio engine is not running", "NotReadableError");
      }

      this.starting = false;
      this.running = true;
      this.#watchAudioState(token);
      this.lastAnalysisAtMs = Number.NEGATIVE_INFINITY;
      this.lastContextTimeSeconds = null;
      this.lastContextProgressAtMs = null;
      this.mutedAtMs = null;
      this.#scheduleFrame(token);
    } catch (error) {
      if (token !== this.generation) {
        return;
      }
      await this.stop();
      throw error;
    } finally {
      if (token === this.generation) {
        this.startupAbortController = null;
      }
    }
  }

  async stop() {
    this.generation += 1;
    this.starting = false;
    this.running = false;
    this.startupAbortController?.abort();
    this.startupAbortController = null;
    for (const removeListener of this.removeListeners) {
      removeListener();
    }
    this.removeListeners = [];

    if (this.animationFrameId !== null) {
      this.environment.cancelAnimationFrame?.(this.animationFrameId);
      this.animationFrameId = null;
    }

    const sourceNode = this.sourceNode;
    const analyserNode = this.analyserNode;
    const stream = this.stream;
    const context = this.audioContext;
    this.#clearReferences();

    try {
      sourceNode?.disconnect();
    } catch {
      // A partially initialized node can already be disconnected.
    }
    try {
      analyserNode?.disconnect();
    } catch {
      // A partially initialized node can already be disconnected.
    }
    stopTracks(stream);
    if (context && context.state !== "closed") {
      await context.close().catch(() => {});
    }
  }

  #watchAudioState(token) {
    const context = this.audioContext;
    const onStateChange = () => {
      if (context.state !== "running") {
        this.#fail(new DOMException("Audio engine was interrupted", "AudioContextInterruptedError"), token);
      }
    };
    context.addEventListener("statechange", onStateChange);
    this.removeListeners.push(() => context.removeEventListener("statechange", onStateChange));

    for (const track of this.stream.getAudioTracks()) {
      if (track.readyState === "ended") {
        throw new DOMException("Microphone capture has ended", "NotReadableError");
      }
      const onEnded = () => {
        this.#fail(new DOMException("Microphone capture has ended", "NotReadableError"), token);
      };
      track.addEventListener("ended", onEnded);
      this.removeListeners.push(() => track.removeEventListener("ended", onEnded));
    }
  }

  #fail(error, token) {
    if (!this.running || token !== this.generation) {
      return;
    }
    void this.stop();
    this.onError(error);
  }

  #checkAudioHealth(timestampMs) {
    // Some WebKit failures leave state as "running" while rendering is frozen.
    const contextTime = this.audioContext.currentTime;
    if (Number.isFinite(contextTime)) {
      if (this.lastContextTimeSeconds === null || contextTime > this.lastContextTimeSeconds) {
        this.lastContextTimeSeconds = contextTime;
        this.lastContextProgressAtMs = timestampMs;
      } else if (timestampMs - this.lastContextProgressAtMs >= 3000) {
        throw new DOMException("Audio engine clock stopped", "AudioContextInterruptedError");
      }
    }

    const tracks = this.stream.getAudioTracks();
    if (tracks.some((track) => track.readyState === "ended" || track.enabled === false)) {
      throw new DOMException("Microphone capture has ended", "NotReadableError");
    }
    if (tracks.some((track) => track.muted)) {
      this.mutedAtMs ??= timestampMs;
      if (timestampMs - this.mutedAtMs >= 3000) {
        throw new DOMException("Microphone remains muted", "MicrophoneMutedError");
      }
    } else {
      this.mutedAtMs = null;
    }
  }

  #scheduleFrame(token) {
    const requestFrame = this.environment.requestAnimationFrame?.bind(this.environment);
    if (!requestFrame) {
      throw new DOMException("Animation frames are unavailable", "NotSupportedError");
    }

    this.animationFrameId = requestFrame((timestampMs) => {
      if (!this.running || token !== this.generation) {
        return;
      }

      try {
        if (this.audioContext.state !== "running") {
          throw new DOMException("Audio engine was interrupted", "AudioContextInterruptedError");
        }
        if (timestampMs - this.lastAnalysisAtMs >= this.analysisIntervalMs) {
          this.#checkAudioHealth(timestampMs);
          this.analyserNode.getFloatTimeDomainData(this.samples);
          this.lastAnalysisAtMs = timestampMs;
          // The callback is synchronous. It must not retain the reused sample array.
          this.onFrame(this.samples, this.audioContext.sampleRate, timestampMs);
        }
        if (this.running && token === this.generation) {
          this.#scheduleFrame(token);
        }
      } catch (error) {
        this.#fail(error, token);
      }
    });
  }

  #clearReferences() {
    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.samples = null;
    this.animationFrameId = null;
  }
}
