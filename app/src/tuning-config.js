export const APP_VERSION = "0.1.0";

export const STANDARD_HIGH_G = Object.freeze({
  id: "ukulele-standard-high-g",
  displayName: "尤克里里标准 High-G",
  referenceA4Hz: 440,
  detectionRangeHz: Object.freeze({
    minimum: 180,
    maximum: 500
  }),
  inTuneToleranceCents: 5,
  inTuneExitToleranceCents: 7,
  maximumAutoMatchDistanceCents: 250,
  strings: Object.freeze([
    Object.freeze({ position: 4, note: "G4", label: "G", frequencyHz: 391.995436 }),
    Object.freeze({ position: 3, note: "C4", label: "C", frequencyHz: 261.625565 }),
    Object.freeze({ position: 2, note: "E4", label: "E", frequencyHz: 329.627557 }),
    Object.freeze({ position: 1, note: "A4", label: "A", frequencyHz: 440 })
  ])
});

export function findTargetByNote(note, configuration = STANDARD_HIGH_G) {
  if (!note) {
    return null;
  }
  return configuration.strings.find((target) => target.note === note) ?? null;
}

