import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeAudioFile,
  AudioFileAnalysisError,
  aggregateTuningResults,
  MAX_AUDIO_FILE_BYTES,
  validateAudioFile
} from "../app/src/audio-file-analyzer.js";
import { findTargetByNote } from "../app/src/tuning-config.js";
import { makeTuningResult } from "../app/src/tuning-math.js";

function result(note, cents, confidence = 0.95) {
  const target = findTargetByNote(note);
  return makeTuningResult({
    frequencyHz: target.frequencyHz * (2 ** (cents / 1200)),
    confidence,
    rms: 0.15
  });
}

test("recording validation accepts supported local audio and rejects bad input", () => {
  assert.doesNotThrow(() => validateAudioFile({ name: "uke.m4a", size: 1024, type: "" }));
  assert.doesNotThrow(() => validateAudioFile({ name: "take.bin", size: 1024, type: "audio/mp4" }));
  assert.throws(
    () => validateAudioFile({ name: "notes.txt", size: 100, type: "text/plain" }),
    (error) => error instanceof AudioFileAnalysisError && error.code === "unsupported-format"
  );
  assert.throws(
    () => validateAudioFile({ name: "large.wav", size: MAX_AUDIO_FILE_BYTES + 1, type: "audio/wav" }),
    (error) => error instanceof AudioFileAnalysisError && error.code === "file-too-large"
  );
});

test("recording aggregation selects the dominant string and median cents", () => {
  const aggregate = aggregateTuningResults([
    result("C4", -8),
    result("C4", -4),
    result("C4", -6),
    result("E4", 2),
    result("E4", 3)
  ]);

  assert.equal(aggregate?.target.note, "C4");
  assert.ok(Math.abs(aggregate.cents - (-6)) < 1e-9);
  assert.equal(aggregate?.direction, "too-low");
  assert.equal(aggregate?.acceptedWindows, 3);
  assert.equal(aggregateTuningResults([result("A4", 0)]), null);
});

test("recording analysis decodes locally, samples complete windows, and closes context", async () => {
  const frameCount = 12_288;
  const audioBuffer = {
    duration: frameCount / 48_000,
    length: frameCount,
    sampleRate: 48_000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(frameCount).fill(0.2)
  };

  class FakeAudioContext {
    static lastInstance = null;

    constructor() {
      this.state = "running";
      FakeAudioContext.lastInstance = this;
    }

    async decodeAudioData() {
      return audioBuffer;
    }

    async close() {
      this.state = "closed";
    }
  }

  const detector = {
    detect() {
      return { frequencyHz: 440, confidence: 0.99, rms: 0.2 };
    }
  };
  const progress = [];
  const file = {
    name: "take.wav",
    size: 128,
    type: "audio/wav",
    async arrayBuffer() {
      return new ArrayBuffer(8);
    }
  };

  const analysis = await analyzeAudioFile(file, {
    detector,
    onProgress: (value) => progress.push(value),
    environment: { AudioContext: FakeAudioContext, setTimeout }
  });

  assert.equal(analysis.result.target.note, "A4");
  assert.equal(analysis.analyzedWindows, 5);
  assert.equal(analysis.acceptedWindows, 5);
  assert.equal(progress.at(-1), 1);
  assert.equal(FakeAudioContext.lastInstance.state, "closed");
});

test("recording analysis honors an existing cancellation signal", async () => {
  const signalController = new AbortController();
  signalController.abort();
  class FakeAudioContext {
    constructor() {
      this.state = "running";
    }
    async close() {
      this.state = "closed";
    }
  }

  await assert.rejects(
    analyzeAudioFile(
      {
        name: "take.wav",
        size: 128,
        type: "audio/wav",
        async arrayBuffer() {
          return new ArrayBuffer(8);
        }
      },
      {
        detector: { detect: () => null },
        signal: signalController.signal,
        environment: { AudioContext: FakeAudioContext, setTimeout }
      }
    ),
    (error) => error instanceof AudioFileAnalysisError && error.code === "aborted"
  );
});
