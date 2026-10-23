import test from "node:test";
import assert from "node:assert/strict";

import { MicrophoneSource } from "../app/src/microphone-source.js";

function makeEnvironment() {
  const state = {
    animationCallback: null,
    animationCancelled: false,
    sourceDisconnected: false,
    analyserDisconnected: false,
    trackStopped: false,
    contextClosed: false,
    resumeCalls: 0
  };

  const track = new EventTarget();
  track.readyState = "live";
  track.stop = () => {
    track.readyState = "ended";
    state.trackStopped = true;
  };
  const stream = {
    getTracks() {
      return [track];
    },
    getAudioTracks() {
      return [track];
    }
  };

  class FakeAudioContext extends EventTarget {
    constructor() {
      super();
      this.state = "running";
      this.sampleRate = 48_000;
      state.context = this;
    }

    async resume() {
      state.resumeCalls += 1;
      this.state = "running";
    }

    createMediaStreamSource() {
      return {
        connect() {},
        disconnect() {
          state.sourceDisconnected = true;
        }
      };
    }

    createAnalyser() {
      return {
        fftSize: 0,
        smoothingTimeConstant: 0,
        getFloatTimeDomainData(samples) {
          samples.fill(0.1);
        },
        disconnect() {
          state.analyserDisconnected = true;
        }
      };
    }

    async close() {
      this.state = "closed";
      state.contextClosed = true;
    }
  }

  return {
    state,
    stream,
    track,
    environment: {
      AudioContext: FakeAudioContext,
      navigator: {
        mediaDevices: {
          async getUserMedia() {
            return stream;
          }
        }
      },
      requestAnimationFrame(callback) {
        state.animationCallback = callback;
        return 42;
      },
      cancelAnimationFrame(identifier) {
        assert.equal(identifier, 42);
        state.animationCancelled = true;
      }
    }
  };
}

test("microphone source reads frames and releases every browser resource", async () => {
  const { state, environment } = makeEnvironment();
  let frames = 0;
  const source = new MicrophoneSource({
    environment,
    onFrame(samples, sampleRateHz) {
      frames += 1;
      assert.equal(samples.length, 4096);
      assert.equal(sampleRateHz, 48_000);
    }
  });

  await source.start();
  assert.equal(source.isRunning, true);
  assert.equal(source.isStarting, false);
  state.animationCallback(100);
  assert.equal(frames, 1);

  await source.stop();
  assert.equal(source.isRunning, false);
  assert.equal(state.animationCancelled, true);
  assert.equal(state.sourceDisconnected, true);
  assert.equal(state.analyserDisconnected, true);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
});

test("microphone start fails cleanly when browser capture is unavailable", async () => {
  const source = new MicrophoneSource({
    environment: {},
    onFrame() {}
  });

  await assert.rejects(source.start(), (error) => error.name === "NotSupportedError");
  assert.equal(source.isRunning, false);
  assert.equal(source.isStarting, false);
});

test("a pending AudioContext resume does not block the microphone permission request", async () => {
  const { environment, state, stream } = makeEnvironment();
  let resolveResume;
  let mediaRequests = 0;

  class SuspendedAudioContext extends environment.AudioContext {
    constructor() {
      super();
      this.state = "suspended";
    }

    async resume() {
      await new Promise((resolve) => {
        resolveResume = resolve;
      });
      this.state = "running";
    }
  }

  environment.AudioContext = SuspendedAudioContext;
  environment.navigator.mediaDevices.getUserMedia = async () => {
    mediaRequests += 1;
    resolveResume();
    return stream;
  };
  const source = new MicrophoneSource({ environment, onFrame() {} });

  const pendingStart = source.start();
  const permissionRequestedImmediately = mediaRequests === 1;
  // Unblock the old implementation so the regression reports an assertion failure.
  if (!permissionRequestedImmediately) {
    resolveResume();
  }
  await pendingStart;
  await source.stop();

  assert.equal(permissionRequestedImmediately, true);
  assert.equal(state.trackStopped, true);
});

test("microphone start resumes a context interrupted by the permission prompt", async () => {
  const { environment, state, stream } = makeEnvironment();
  environment.navigator.mediaDevices.getUserMedia = async () => {
    state.context.state = "interrupted";
    return stream;
  };
  const source = new MicrophoneSource({ environment, onFrame() {} });

  await source.start();
  const contextState = state.context.state;
  const resumeCalls = state.resumeCalls;
  await source.stop();

  assert.equal(contextState, "running");
  assert.equal(resumeCalls, 1);
});

test("stopping during a permission request releases a late stream", async () => {
  const { environment, state, stream } = makeEnvironment();
  let resolveCapture;
  environment.navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => {
    resolveCapture = resolve;
  });
  const source = new MicrophoneSource({ environment, onFrame() {} });

  const pendingStart = source.start();
  await source.stop();
  resolveCapture(stream);
  await pendingStart;

  assert.equal(source.isStarting, false);
  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
});

test("a context that stays interrupted cannot report microphone capture as running", async () => {
  const { environment, state, stream } = makeEnvironment();
  environment.navigator.mediaDevices.getUserMedia = async () => {
    state.context.state = "interrupted";
    state.context.resume = async () => {};
    return stream;
  };
  const source = new MicrophoneSource({ environment, onFrame() {} });

  await assert.rejects(source.start(), { name: "NotReadableError" });
  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
});

test("an unresolved post-permission resume times out and releases capture", async () => {
  const { environment, state, stream } = makeEnvironment();
  environment.navigator.mediaDevices.getUserMedia = async () => {
    state.context.state = "interrupted";
    state.context.resume = () => new Promise(() => {});
    return stream;
  };
  const source = new MicrophoneSource({
    environment,
    startupTimeoutMs: 20,
    onFrame() {}
  });

  await assert.rejects(source.start(), { name: "TimeoutError" });
  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
});

test("stopping cancels startup even if the browser never answers the permission request", async () => {
  const { environment, state } = makeEnvironment();
  environment.navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
  const source = new MicrophoneSource({ environment, onFrame() {} });

  const pendingStart = source.start();
  assert.equal(source.isStarting, true);
  await source.stop();
  await pendingStart;

  assert.equal(source.isStarting, false);
  assert.equal(source.isRunning, false);
  assert.equal(state.contextClosed, true);
});

test("an interrupted context stops capture and reports a recoverable error", async () => {
  const { environment, state } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({ environment, onFrame() {}, onError: (error) => errors.push(error) });

  await source.start();
  state.context.state = "interrupted";
  state.context.dispatchEvent(new Event("statechange"));

  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "AudioContextInterruptedError");
});

test("an ended audio track stops capture instead of silently reading zeros", async () => {
  const { environment, state, track } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({ environment, onFrame() {}, onError: (error) => errors.push(error) });

  await source.start();
  track.readyState = "ended";
  track.dispatchEvent(new Event("ended"));

  assert.equal(source.isRunning, false);
  assert.equal(state.contextClosed, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, "NotReadableError");
});

test("a frame processing error releases the microphone and allows restarting", async () => {
  const { environment, state } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({
    environment,
    onFrame() { throw new Error("Frame processing failed"); },
    onError: (error) => errors.push(error)
  });

  await source.start();
  state.animationCallback(100);

  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(state.contextClosed, true);
  assert.equal(errors.length, 1);
  environment.navigator.mediaDevices.getUserMedia = async () => makeEnvironment().stream;
  await source.start();
  assert.equal(source.isRunning, true);
  await source.stop();
});

test("a frozen audio clock is detected even if the context still reports running", async () => {
  const { environment, state } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({ environment, onFrame() {}, onError: (error) => errors.push(error) });
  await source.start();
  state.context.currentTime = 0;
  state.animationCallback(0);
  state.animationCallback(3000);

  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(errors[0].name, "AudioContextInterruptedError");
});

test("a persistently muted microphone is reported instead of listening forever", async () => {
  const { environment, state, track } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({ environment, onFrame() {}, onError: (error) => errors.push(error) });
  await source.start();
  track.muted = true;
  state.animationCallback(0);
  state.animationCallback(3000);

  assert.equal(source.isRunning, false);
  assert.equal(state.trackStopped, true);
  assert.equal(errors[0].name, "MicrophoneMutedError");
});

test("quiet input with a progressing audio clock keeps capture running", async () => {
  const { environment, state } = makeEnvironment();
  const errors = [];
  const source = new MicrophoneSource({ environment, onFrame() {}, onError: (error) => errors.push(error) });
  await source.start();
  state.context.currentTime = 0;
  state.animationCallback(0);
  state.context.currentTime = 3;
  state.animationCallback(3000);

  assert.equal(source.isRunning, true);
  assert.equal(errors.length, 0);
  await source.stop();
});

test("a failed old permission request cannot tear down a newer capture session", async () => {
  const { environment } = makeEnvironment();
  let rejectOldCapture;
  environment.navigator.mediaDevices.getUserMedia = () => new Promise((resolve, reject) => {
    rejectOldCapture = reject;
  });
  const source = new MicrophoneSource({ environment, onFrame() {} });
  const oldStart = source.start();
  await source.stop();
  await oldStart;

  environment.navigator.mediaDevices.getUserMedia = async () => makeEnvironment().stream;
  await source.start();
  rejectOldCapture(new DOMException("Old permission denied", "NotAllowedError"));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(source.isRunning, true);
  await source.stop();
});
