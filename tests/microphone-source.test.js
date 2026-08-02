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
    contextClosed: false
  };

  const stream = {
    getTracks() {
      return [{
        stop() {
          state.trackStopped = true;
        }
      }];
    }
  };

  class FakeAudioContext {
    constructor() {
      this.state = "running";
      this.sampleRate = 48_000;
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

test("stopping during AudioContext resume prevents a later permission request", async () => {
  let resolveResume;
  let mediaRequests = 0;
  let contextClosed = false;

  class SuspendedAudioContext {
    constructor() {
      this.state = "suspended";
    }

    async resume() {
      await new Promise((resolve) => {
        resolveResume = resolve;
      });
      this.state = "running";
    }

    async close() {
      this.state = "closed";
      contextClosed = true;
    }
  }

  const source = new MicrophoneSource({
    environment: {
      AudioContext: SuspendedAudioContext,
      navigator: {
        mediaDevices: {
          async getUserMedia() {
            mediaRequests += 1;
            return { getTracks: () => [] };
          }
        }
      }
    },
    onFrame() {}
  });

  const pendingStart = source.start();
  assert.equal(source.isStarting, true);
  await source.stop();
  resolveResume();
  await pendingStart;

  assert.equal(source.isStarting, false);
  assert.equal(source.isRunning, false);
  assert.equal(mediaRequests, 0);
  assert.equal(contextClosed, true);
});
