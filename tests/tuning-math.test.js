import test from "node:test";
import assert from "node:assert/strict";

import {
  centsBetween,
  closestTarget,
  frequencyAtCents,
  makeTuningResult,
  median,
  tuningDirection
} from "../app/src/tuning-math.js";

test("cents and frequency conversions are inverse operations", () => {
  const frequency = frequencyAtCents(440, 100);
  assert.ok(Math.abs(frequency - 466.163762) < 0.00001);
  assert.ok(Math.abs(centsBetween(frequency, 440) - 100) < 1e-9);
  assert.equal(centsBetween(0, 440), null);
  assert.equal(frequencyAtCents(440, Number.NaN), null);
});

test("auto matching identifies all four standard High-G strings", () => {
  const expected = [
    [391.995436, "G4"],
    [261.625565, "C4"],
    [329.627557, "E4"],
    [440, "A4"]
  ];

  for (const [frequency, note] of expected) {
    const match = closestTarget(frequency);
    assert.equal(match?.target.note, note);
    assert.ok(Math.abs(match.cents) < 0.000001);
  }
  assert.equal(closestTarget(180), null);
});

test("direction uses a five-cent inclusive in-tune window", () => {
  assert.equal(tuningDirection(-5), "in-tune");
  assert.equal(tuningDirection(0), "in-tune");
  assert.equal(tuningDirection(5), "in-tune");
  assert.equal(tuningDirection(-5.01), "too-low");
  assert.equal(tuningDirection(5.01), "too-high");
});

test("manual target selection locks the result to the chosen string", () => {
  const result = makeTuningResult(
    { frequencyHz: 440, confidence: 0.99, rms: 0.2 },
    { lockedTargetNote: "C4" }
  );

  assert.equal(result?.target.note, "C4");
  assert.equal(result?.direction, "too-high");
});

test("median ignores non-finite values and does not mutate the input", () => {
  const values = [9, Number.NaN, 1, 5];
  assert.equal(median(values), 5);
  assert.deepEqual(values, [9, Number.NaN, 1, 5]);
  assert.equal(median([Number.NaN]), null);
});

