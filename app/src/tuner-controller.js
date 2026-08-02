import { STANDARD_HIGH_G, findTargetByNote } from "./tuning-config.js";
import { makeTuningResult } from "./tuning-math.js";
import { PitchStabilizer } from "./pitch-stabilizer.js";

export class TunerController {
  constructor({
    detector,
    configuration = STANDARD_HIGH_G,
    stabilizer = new PitchStabilizer()
  }) {
    if (!detector || typeof detector.detect !== "function") {
      throw new TypeError("A pitch detector is required");
    }
    this.detector = detector;
    this.configuration = configuration;
    this.stabilizer = stabilizer;
    this.lockedTargetNote = null;
  }

  setLockedTarget(note = null) {
    if (note !== null && !findTargetByNote(note, this.configuration)) {
      throw new RangeError(`Unknown target note: ${note}`);
    }
    this.lockedTargetNote = note;
    this.stabilizer.reset();
  }

  resetSignal() {
    this.stabilizer.reset();
  }

  processSamples(samples, sampleRateHz, timestampMs) {
    const estimate = this.detector.detect(samples, sampleRateHz);
    return this.processEstimate(estimate, timestampMs);
  }

  processEstimate(estimate, timestampMs) {
    if (!estimate) {
      const expired = this.stabilizer.expireIfNeeded(timestampMs);
      return Object.freeze({ kind: expired ? "expired" : "no-signal" });
    }

    const rawResult = makeTuningResult(estimate, {
      lockedTargetNote: this.lockedTargetNote,
      configuration: this.configuration
    });
    if (!rawResult) {
      const expired = this.stabilizer.expireIfNeeded(timestampMs);
      return Object.freeze({ kind: expired ? "expired" : "uncertain" });
    }

    const stableResult = this.stabilizer.push(rawResult, timestampMs);
    if (!stableResult) {
      return Object.freeze({ kind: "stabilizing" });
    }

    return Object.freeze({ kind: "result", result: stableResult });
  }
}
