import test from "node:test";
import assert from "node:assert/strict";

import { YinPitchDetector } from "../app/src/yin-pitch-detector.js";

const SAMPLE_RATE = 48_000;
const WINDOW_SIZE = 4_096;

function sineWave(frequencyHz, { amplitude = 0.3, harmonic = 0 } = {}) {
  const samples = new Float32Array(WINDOW_SIZE);
  for (let index = 0; index < samples.length; index += 1) {
    const phase = 2 * Math.PI * frequencyHz * index / SAMPLE_RATE;
    samples[index] = amplitude * (
      Math.sin(phase) + harmonic * Math.sin(phase * 2 + 0.2)
    );
  }
  return samples;
}

test("YIN detects all four standard ukulele pitches", () => {
  const detector = new YinPitchDetector();
  for (const frequencyHz of [261.625565, 329.627557, 391.995436, 440]) {
    const estimate = detector.detect(sineWave(frequencyHz), SAMPLE_RATE);
    assert.ok(estimate, `Expected a pitch estimate for ${frequencyHz} Hz`);
    assert.ok(
      Math.abs(estimate.frequencyHz - frequencyHz) < 0.6,
      `Expected ${frequencyHz} Hz, received ${estimate.frequencyHz} Hz`
    );
    assert.ok(estimate.confidence > 0.9);
  }
});

test("YIN keeps the fundamental when a second harmonic is present", () => {
  const detector = new YinPitchDetector();
  const estimate = detector.detect(
    sineWave(329.627557, { amplitude: 0.18, harmonic: 1.8 }),
    SAMPLE_RATE
  );
  assert.ok(estimate);
  assert.ok(Math.abs(estimate.frequencyHz - 329.627557) < 0.8);
});

test("YIN tracks pitches ten cents above and below a string target", () => {
  const detector = new YinPitchDetector();
  for (const cents of [-10, 10]) {
    const expectedFrequencyHz = 391.995436 * (2 ** (cents / 1200));
    const estimate = detector.detect(sineWave(expectedFrequencyHz), SAMPLE_RATE);
    assert.ok(estimate);
    assert.ok(Math.abs(estimate.frequencyHz - expectedFrequencyHz) < 0.6);
  }
});

test("YIN rejects silence, very quiet input, and malformed samples", () => {
  const detector = new YinPitchDetector();
  assert.equal(detector.detect(new Float32Array(WINDOW_SIZE), SAMPLE_RATE), null);
  assert.equal(
    detector.detect(sineWave(440, { amplitude: 0.0005 }), SAMPLE_RATE),
    null
  );

  const malformed = sineWave(440);
  malformed[100] = Number.NaN;
  assert.equal(detector.detect(malformed, SAMPLE_RATE), null);
});
