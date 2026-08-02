import test from "node:test";
import assert from "node:assert/strict";

import { PitchStabilizer } from "../app/src/pitch-stabilizer.js";
import { STANDARD_HIGH_G, findTargetByNote } from "../app/src/tuning-config.js";
import { frequencyAtCents } from "../app/src/tuning-math.js";

function rawResult(note, cents) {
  const target = findTargetByNote(note);
  return {
    target,
    detectedFrequencyHz: frequencyAtCents(target.frequencyHz, cents),
    cents,
    direction: null,
    confidence: 0.96,
    rms: 0.12
  };
}

test("stabilizer requires consecutive frames before switching strings", () => {
  const stabilizer = new PitchStabilizer({
    historySize: 1,
    smoothingAlpha: 1,
    targetSwitchFrames: 2
  });

  assert.equal(stabilizer.push(rawResult("C4", 0), 0)?.target.note, "C4");
  assert.equal(stabilizer.push(rawResult("E4", 0), 50), null);
  assert.equal(stabilizer.push(rawResult("E4", 0), 100)?.target.note, "E4");
});

test("in-tune hysteresis prevents boundary flicker", () => {
  const stabilizer = new PitchStabilizer({
    historySize: 1,
    smoothingAlpha: 1,
    targetSwitchFrames: 1,
    enterToleranceCents: 5,
    exitToleranceCents: 7
  });

  assert.equal(stabilizer.push(rawResult("A4", 4), 0)?.direction, "in-tune");
  assert.equal(stabilizer.push(rawResult("A4", 6), 50)?.direction, "in-tune");
  assert.equal(stabilizer.push(rawResult("A4", 8), 100)?.direction, "too-high");
  assert.equal(stabilizer.push(rawResult("A4", 6), 150)?.direction, "too-high");
  assert.equal(stabilizer.push(rawResult("A4", 4), 200)?.direction, "in-tune");
});

test("stabilizer expires stale signals", () => {
  const stabilizer = new PitchStabilizer({ signalTimeoutMs: 700 });
  stabilizer.push(rawResult("G4", 0), 100);
  assert.equal(stabilizer.expireIfNeeded(799), false);
  assert.equal(stabilizer.expireIfNeeded(800), true);
  assert.equal(stabilizer.currentTargetNote, null);
  assert.equal(STANDARD_HIGH_G.inTuneExitToleranceCents > STANDARD_HIGH_G.inTuneToleranceCents, true);
});

