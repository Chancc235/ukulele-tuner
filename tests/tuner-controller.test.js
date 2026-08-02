import test from "node:test";
import assert from "node:assert/strict";

import { PitchStabilizer } from "../app/src/pitch-stabilizer.js";
import { TunerController } from "../app/src/tuner-controller.js";

const detector = { detect: () => null };

test("controller expires an old reading when new estimates cannot match a string", () => {
  const controller = new TunerController({
    detector,
    stabilizer: new PitchStabilizer({
      historySize: 1,
      smoothingAlpha: 1,
      targetSwitchFrames: 1,
      signalTimeoutMs: 700
    })
  });

  const validEstimate = { frequencyHz: 440, confidence: 0.98, rms: 0.2 };
  const unmatchedEstimate = { frequencyHz: 180, confidence: 0.98, rms: 0.2 };

  assert.equal(controller.processEstimate(validEstimate, 0).kind, "result");
  assert.equal(controller.processEstimate(unmatchedEstimate, 699).kind, "uncertain");
  assert.equal(controller.processEstimate(unmatchedEstimate, 700).kind, "expired");
});

test("controller respects a manually locked target", () => {
  const controller = new TunerController({ detector });
  controller.setLockedTarget("C4");

  const outcome = controller.processEstimate(
    { frequencyHz: 440, confidence: 0.98, rms: 0.2 },
    0
  );
  assert.equal(outcome.kind, "result");
  assert.equal(outcome.result.target.note, "C4");
});

