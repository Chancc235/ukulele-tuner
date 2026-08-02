import Foundation

public enum TuningMath {
    /// Returns the signed musical distance from `targetFrequencyHz` to
    /// `detectedFrequencyHz`, or nil for invalid input.
    public static func cents(
        detectedFrequencyHz: Double,
        targetFrequencyHz: Double
    ) -> Double? {
        guard detectedFrequencyHz.isFinite,
              targetFrequencyHz.isFinite,
              detectedFrequencyHz > 0,
              targetFrequencyHz > 0 else {
            return nil
        }

        return 1_200.0 * log2(detectedFrequencyHz / targetFrequencyHz)
    }

    public static func closestTarget(
        to detectedFrequencyHz: Double,
        configuration: TuningConfiguration = .standardHighG
    ) -> (target: UkuleleString, cents: Double)? {
        let candidates = configuration.targets.compactMap { target -> (UkuleleString, Double)? in
            guard let distance = cents(
                detectedFrequencyHz: detectedFrequencyHz,
                targetFrequencyHz: target.frequencyHz
            ) else {
                return nil
            }
            return (target, distance)
        }

        guard let closest = candidates.min(by: { abs($0.1) < abs($1.1) }),
              abs(closest.1) <= configuration.maximumAutoMatchDistanceCents else {
            return nil
        }

        return (closest.0, closest.1)
    }

    public static func result(
        from estimate: PitchEstimate,
        lockedTarget: UkuleleString? = nil,
        configuration: TuningConfiguration = .standardHighG
    ) -> TuningResult? {
        let match: (target: UkuleleString, cents: Double)?

        if let lockedTarget {
            guard let distance = cents(
                detectedFrequencyHz: estimate.frequencyHz,
                targetFrequencyHz: lockedTarget.frequencyHz
            ) else {
                return nil
            }
            match = (lockedTarget, distance)
        } else {
            match = closestTarget(
                to: estimate.frequencyHz,
                configuration: configuration
            )
        }

        guard let match else { return nil }

        let direction: TuningDirection
        if match.cents < -configuration.inTuneToleranceCents {
            direction = .tooLow
        } else if match.cents > configuration.inTuneToleranceCents {
            direction = .tooHigh
        } else {
            direction = .inTune
        }

        return TuningResult(
            target: match.target,
            detectedFrequencyHz: estimate.frequencyHz,
            cents: match.cents,
            direction: direction,
            confidence: estimate.confidence
        )
    }
}

