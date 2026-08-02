import { STANDARD_HIGH_G, findTargetByNote } from "./tuning-config.js";

const FLOATING_POINT_EPSILON = 1e-9;

export function centsBetween(detectedFrequencyHz, targetFrequencyHz) {
  if (!Number.isFinite(detectedFrequencyHz)
      || !Number.isFinite(targetFrequencyHz)
      || detectedFrequencyHz <= 0
      || targetFrequencyHz <= 0) {
    return null;
  }

  return 1200 * Math.log2(detectedFrequencyHz / targetFrequencyHz);
}

export function closestTarget(
  detectedFrequencyHz,
  configuration = STANDARD_HIGH_G
) {
  let bestMatch = null;

  for (const target of configuration.strings) {
    const cents = centsBetween(detectedFrequencyHz, target.frequencyHz);
    if (cents === null) {
      return null;
    }

    if (!bestMatch || Math.abs(cents) < Math.abs(bestMatch.cents)) {
      bestMatch = { target, cents };
    }
  }

  if (!bestMatch
      || Math.abs(bestMatch.cents) > configuration.maximumAutoMatchDistanceCents) {
    return null;
  }

  return bestMatch;
}

export function tuningDirection(
  cents,
  toleranceCents = STANDARD_HIGH_G.inTuneToleranceCents
) {
  if (!Number.isFinite(cents) || !Number.isFinite(toleranceCents) || toleranceCents < 0) {
    return null;
  }

  if (cents < -toleranceCents - FLOATING_POINT_EPSILON) {
    return "too-low";
  }
  if (cents > toleranceCents + FLOATING_POINT_EPSILON) {
    return "too-high";
  }
  return "in-tune";
}

export function makeTuningResult(
  pitchEstimate,
  {
    lockedTargetNote = null,
    configuration = STANDARD_HIGH_G
  } = {}
) {
  if (!pitchEstimate
      || !Number.isFinite(pitchEstimate.frequencyHz)
      || !Number.isFinite(pitchEstimate.confidence)
      || !Number.isFinite(pitchEstimate.rms)) {
    return null;
  }

  let match;
  if (lockedTargetNote) {
    const target = findTargetByNote(lockedTargetNote, configuration);
    if (!target) {
      return null;
    }
    const cents = centsBetween(pitchEstimate.frequencyHz, target.frequencyHz);
    if (cents === null) {
      return null;
    }
    match = { target, cents };
  } else {
    match = closestTarget(pitchEstimate.frequencyHz, configuration);
  }

  if (!match) {
    return null;
  }

  return Object.freeze({
    target: match.target,
    detectedFrequencyHz: pitchEstimate.frequencyHz,
    cents: match.cents,
    direction: tuningDirection(match.cents, configuration.inTuneToleranceCents),
    confidence: pitchEstimate.confidence,
    rms: pitchEstimate.rms
  });
}

export function frequencyAtCents(targetFrequencyHz, cents) {
  if (!Number.isFinite(targetFrequencyHz)
      || targetFrequencyHz <= 0
      || !Number.isFinite(cents)) {
    return null;
  }
  return targetFrequencyHz * (2 ** (cents / 1200));
}

export function median(values) {
  const finiteValues = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finiteValues.length === 0) {
    return null;
  }

  const middle = Math.floor(finiteValues.length / 2);
  return finiteValues.length % 2 === 0
    ? (finiteValues[middle - 1] + finiteValues[middle]) / 2
    : finiteValues[middle];
}
