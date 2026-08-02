import { STANDARD_HIGH_G } from "./tuning-config.js";
import { frequencyAtCents, median, tuningDirection } from "./tuning-math.js";

export class PitchStabilizer {
  constructor({
    historySize = 5,
    smoothingAlpha = 0.35,
    targetSwitchFrames = 2,
    signalTimeoutMs = 700,
    enterToleranceCents = STANDARD_HIGH_G.inTuneToleranceCents,
    exitToleranceCents = STANDARD_HIGH_G.inTuneExitToleranceCents
  } = {}) {
    if (!Number.isInteger(historySize) || historySize < 1) {
      throw new RangeError("historySize must be a positive integer");
    }
    if (!Number.isFinite(smoothingAlpha) || smoothingAlpha <= 0 || smoothingAlpha > 1) {
      throw new RangeError("smoothingAlpha must be in (0, 1]");
    }
    if (!Number.isInteger(targetSwitchFrames) || targetSwitchFrames < 1) {
      throw new RangeError("targetSwitchFrames must be a positive integer");
    }
    if (!Number.isFinite(signalTimeoutMs) || signalTimeoutMs <= 0) {
      throw new RangeError("signalTimeoutMs must be positive");
    }

    this.historySize = historySize;
    this.smoothingAlpha = smoothingAlpha;
    this.targetSwitchFrames = targetSwitchFrames;
    this.signalTimeoutMs = signalTimeoutMs;
    this.enterToleranceCents = enterToleranceCents;
    this.exitToleranceCents = exitToleranceCents;
    this.reset();
  }

  reset() {
    this.currentTargetNote = null;
    this.pendingTargetNote = null;
    this.pendingTargetFrames = 0;
    this.centsHistory = [];
    this.confidenceHistory = [];
    this.smoothedCents = null;
    this.currentDirection = null;
    this.lastSignalAtMs = null;
  }

  push(rawResult, timestampMs) {
    if (!rawResult
        || !rawResult.target
        || !Number.isFinite(rawResult.cents)
        || !Number.isFinite(rawResult.confidence)
        || !Number.isFinite(timestampMs)) {
      return null;
    }

    this.lastSignalAtMs = timestampMs;
    const incomingTargetNote = rawResult.target.note;

    if (this.currentTargetNote === null) {
      this.#switchTarget(incomingTargetNote);
    } else if (incomingTargetNote !== this.currentTargetNote) {
      if (incomingTargetNote === this.pendingTargetNote) {
        this.pendingTargetFrames += 1;
      } else {
        this.pendingTargetNote = incomingTargetNote;
        this.pendingTargetFrames = 1;
      }

      if (this.pendingTargetFrames < this.targetSwitchFrames) {
        return null;
      }
      this.#switchTarget(incomingTargetNote);
    } else {
      this.pendingTargetNote = null;
      this.pendingTargetFrames = 0;
    }

    this.centsHistory.push(rawResult.cents);
    this.confidenceHistory.push(rawResult.confidence);
    if (this.centsHistory.length > this.historySize) {
      this.centsHistory.shift();
      this.confidenceHistory.shift();
    }

    const medianCents = median(this.centsHistory);
    if (medianCents === null) {
      return null;
    }

    this.smoothedCents = this.smoothedCents === null
      ? medianCents
      : (this.smoothingAlpha * medianCents)
        + ((1 - this.smoothingAlpha) * this.smoothedCents);

    this.currentDirection = this.#directionWithHysteresis(this.smoothedCents);
    const frequencyHz = frequencyAtCents(rawResult.target.frequencyHz, this.smoothedCents);

    return Object.freeze({
      ...rawResult,
      detectedFrequencyHz: frequencyHz,
      cents: this.smoothedCents,
      confidence: median(this.confidenceHistory),
      direction: this.currentDirection,
      stabilizedAtMs: timestampMs
    });
  }

  isExpired(timestampMs) {
    return Number.isFinite(timestampMs)
      && this.lastSignalAtMs !== null
      && timestampMs - this.lastSignalAtMs >= this.signalTimeoutMs;
  }

  expireIfNeeded(timestampMs) {
    if (!this.isExpired(timestampMs)) {
      return false;
    }
    this.reset();
    return true;
  }

  #switchTarget(note) {
    this.currentTargetNote = note;
    this.pendingTargetNote = null;
    this.pendingTargetFrames = 0;
    this.centsHistory = [];
    this.confidenceHistory = [];
    this.smoothedCents = null;
    this.currentDirection = null;
  }

  #directionWithHysteresis(cents) {
    if (this.currentDirection === "in-tune"
        && Math.abs(cents) <= this.exitToleranceCents) {
      return "in-tune";
    }
    return tuningDirection(cents, this.enterToleranceCents);
  }
}

