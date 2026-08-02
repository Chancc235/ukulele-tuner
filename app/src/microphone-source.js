export class MicrophoneSource {
  constructor({
    onFrame,
    analysisIntervalMs = 50,
    fftSize = 4096,
    environment = globalThis
  }) {
    if (typeof onFrame !== "function") {
      throw new TypeError("onFrame callback is required");
    }
    if (!Number.isFinite(analysisIntervalMs) || analysisIntervalMs <= 0) {
      throw new RangeError("analysisIntervalMs must be positive");
    }
    if (!Number.isInteger(fftSize) || fftSize < 32 || (fftSize & (fftSize - 1)) !== 0) {
      throw new RangeError("fftSize must be a power of two");
    }

    this.onFrame = onFrame;
    this.analysisIntervalMs = analysisIntervalMs;
    this.fftSize = fftSize;
    this.environment = environment;
    this.generation = 0;
    this.stream = null;
    this.audioContext = null;
    this.sourceNode = null;
    this.analyserNode = null;
    this.animationFrameId = null;
    this.samples = null;
    this.lastAnalysisAtMs = Number.NEGATIVE_INFINITY;
    this.running = false;
    this.starting = false;
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
    let pendingContext = null;
    let pendingStream = null;

    try {
      pendingContext = new AudioContextConstructor({ latencyHint: "interactive" });
      if (pendingContext.state !== "running") {
        await pendingContext.resume();
      }

      if (token !== this.generation) {
        await pendingContext.close().catch(() => {});
        return;
      }

      pendingStream = await mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: false },
          noiseSuppression: { ideal: false },
          autoGainControl: { ideal: false }
        },
        video: false
      });

      if (token !== this.generation) {
        for (const track of pendingStream.getTracks()) {
          try {
            track.stop();
          } catch {
            // The browser may already have ended the track.
          }
        }
        await pendingContext.close().catch(() => {});
        return;
      }

      this.audioContext = pendingContext;
      this.stream = pendingStream;
      this.sourceNode = pendingContext.createMediaStreamSource(pendingStream);
      this.analyserNode = pendingContext.createAnalyser();
      this.analyserNode.fftSize = this.fftSize;
      this.analyserNode.smoothingTimeConstant = 0;
      this.samples = new Float32Array(this.analyserNode.fftSize);
      this.sourceNode.connect(this.analyserNode);
      this.starting = false;
      this.running = true;
      this.lastAnalysisAtMs = Number.NEGATIVE_INFINITY;
      this.#scheduleFrame(token);
    } catch (error) {
      this.starting = false;
      this.running = false;
      if (pendingStream) {
        for (const track of pendingStream.getTracks()) {
          try {
            track.stop();
          } catch {
            // Continue cleaning up the remaining audio resources.
          }
        }
      }
      if (pendingContext && pendingContext.state !== "closed") {
        await pendingContext.close().catch(() => {});
      }
      this.#clearReferences();
      throw error;
    }
  }

  async stop() {
    this.generation += 1;
    this.starting = false;
    this.running = false;

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
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Continue stopping every track even if one has already ended.
        }
      }
    }
    if (context && context.state !== "closed") {
      await context.close().catch(() => {});
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

      if (timestampMs - this.lastAnalysisAtMs >= this.analysisIntervalMs) {
        this.analyserNode.getFloatTimeDomainData(this.samples);
        this.lastAnalysisAtMs = timestampMs;
        // The callback is synchronous. It must not retain the reused sample array.
        this.onFrame(this.samples, this.audioContext.sampleRate, timestampMs);
      }
      this.#scheduleFrame(token);
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
