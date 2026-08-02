import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { STANDARD_HIGH_G } from "../app/src/tuning-config.js";

test("PWA tuning configuration matches the shared High-G specification", async () => {
  const spec = JSON.parse(await readFile(
    new URL("../spec/standard-high-g.json", import.meta.url),
    "utf8"
  ));

  assert.equal(STANDARD_HIGH_G.id, spec.id);
  assert.equal(STANDARD_HIGH_G.displayName, spec.displayName);
  assert.equal(STANDARD_HIGH_G.referenceA4Hz, spec.referenceA4Hz);
  assert.deepEqual(STANDARD_HIGH_G.detectionRangeHz, {
    minimum: spec.detectionRangeHz.min,
    maximum: spec.detectionRangeHz.max
  });
  assert.equal(STANDARD_HIGH_G.inTuneToleranceCents, spec.inTuneToleranceCents);
  assert.deepEqual(
    STANDARD_HIGH_G.strings.map(({ position, note, frequencyHz }) => ({
      position,
      note,
      frequencyHz
    })),
    spec.strings
  );
});

