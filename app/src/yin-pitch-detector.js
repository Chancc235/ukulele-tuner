import { STANDARD_HIGH_G } from "./tuning-config.js";

export class YinPitchDetector {
  constructor({
    minimumFrequencyHz = STANDARD_HIGH_G.detectionRangeHz.minimum,
    maximumFrequencyHz = STANDARD_HIGH_G.detectionRangeHz.maximum,
    threshold = 0.15,
    minimumRms = 0.003
  } = {}) {
    if (!Number.isFinite(minimumFrequencyHz) || minimumFrequencyHz <= 0) {
      throw new RangeError("minimumFrequencyHz must be positive");
    }
    if (!Number.isFinite(maximumFrequencyHz) || maximumFrequencyHz <= minimumFrequencyHz) {
      throw new RangeError("maximumFrequencyHz must be greater than minimumFrequencyHz");
    }
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
      throw new RangeError("threshold must be between 0 and 1");
    }
    if (!Number.isFinite(minimumRms) || minimumRms < 0) {
      throw new RangeError("minimumRms cannot be negative");
    }

    this.minimumFrequencyHz = minimumFrequencyHz;
    this.maximumFrequencyHz = maximumFrequencyHz;
    this.threshold = threshold;
    this.minimumRms = minimumRms;
  }

  detect(samples, sampleRateHz) {
    if (!samples
        || !Number.isFinite(sampleRateHz)
        || sampleRateHz <= 0
        || samples.length < 64) {
      return null;
    }

    const minimumTau = Math.max(2, Math.floor(sampleRateHz / this.maximumFrequencyHz));
    const maximumTau = Math.ceil(sampleRateHz / this.minimumFrequencyHz);
    if (maximumTau + 2 >= samples.length) {
      return null;
    }

    let mean = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Number(samples[index]);
      if (!Number.isFinite(sample)) {
        return null;
      }
      mean += sample;
    }
    mean /= samples.length;

    const centered = new Float64Array(samples.length);
    let squaredSum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const value = Number(samples[index]) - mean;
      centered[index] = value;
      squaredSum += value * value;
    }

    const rms = Math.sqrt(squaredSum / centered.length);
    if (rms < this.minimumRms) {
      return null;
    }

    const comparisonCount = Math.min(
      Math.floor(centered.length / 2),
      centered.length - maximumTau
    );
    if (comparisonCount <= maximumTau) {
      return null;
    }

    const difference = new Float64Array(maximumTau + 1);
    for (let tau = 1; tau <= maximumTau; tau += 1) {
      let sum = 0;
      for (let index = 0; index < comparisonCount; index += 1) {
        const delta = centered[index] - centered[index + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }

    const normalized = new Float64Array(maximumTau + 1);
    normalized[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maximumTau; tau += 1) {
      runningSum += difference[tau];
      normalized[tau] = runningSum > 0
        ? (difference[tau] * tau) / runningSum
        : 1;
    }

    let candidateTau = null;
    let tau = minimumTau;
    while (tau <= maximumTau) {
      if (normalized[tau] < this.threshold) {
        while (tau + 1 <= maximumTau && normalized[tau + 1] < normalized[tau]) {
          tau += 1;
        }
        candidateTau = tau;
        break;
      }
      tau += 1;
    }

    if (candidateTau === null) {
      return null;
    }

    const refinedTau = this.#parabolicInterpolation(normalized, candidateTau);
    const frequencyHz = sampleRateHz / refinedTau;
    if (!Number.isFinite(frequencyHz)
        || frequencyHz < this.minimumFrequencyHz
        || frequencyHz > this.maximumFrequencyHz) {
      return null;
    }

    return Object.freeze({
      frequencyHz,
      confidence: Math.min(1, Math.max(0, 1 - normalized[candidateTau])),
      rms
    });
  }

  #parabolicInterpolation(values, index) {
    if (index <= 0 || index + 1 >= values.length) {
      return index;
    }

    const left = values[index - 1];
    const center = values[index];
    const right = values[index + 1];
    const denominator = left - (2 * center) + right;
    if (Math.abs(denominator) <= Number.EPSILON) {
      return index;
    }

    const offset = 0.5 * (left - right) / denominator;
    return index + Math.min(1, Math.max(-1, offset));
  }
}

