import Foundation

/// A small, allocation-conscious YIN pitch detector suitable for an MVP.
/// It deliberately contains no audio-session or UI code so it can be tested
/// with deterministic synthetic samples.
public struct YINPitchDetector: PitchDetecting, Sendable {
    public let minimumFrequencyHz: Double
    public let maximumFrequencyHz: Double
    public let threshold: Double
    public let minimumRMS: Double

    public init(
        minimumFrequencyHz: Double = 180.0,
        maximumFrequencyHz: Double = 500.0,
        threshold: Double = 0.15,
        minimumRMS: Double = 0.003
    ) {
        precondition(minimumFrequencyHz > 0)
        precondition(maximumFrequencyHz > minimumFrequencyHz)
        precondition((0.0..<1.0).contains(threshold))
        precondition(minimumRMS >= 0)

        self.minimumFrequencyHz = minimumFrequencyHz
        self.maximumFrequencyHz = maximumFrequencyHz
        self.threshold = threshold
        self.minimumRMS = minimumRMS
    }

    public func estimatePitch(
        samples: [Float],
        sampleRateHz: Double
    ) -> PitchEstimate? {
        guard sampleRateHz.isFinite,
              sampleRateHz > 0,
              samples.count >= 64 else {
            return nil
        }

        let minimumTau = max(2, Int(floor(sampleRateHz / maximumFrequencyHz)))
        let maximumTau = Int(ceil(sampleRateHz / minimumFrequencyHz))
        guard maximumTau + 2 < samples.count else { return nil }

        var mean = 0.0
        for sample in samples {
            let value = Double(sample)
            guard value.isFinite else { return nil }
            mean += value
        }
        mean /= Double(samples.count)

        var centered = [Double]()
        centered.reserveCapacity(samples.count)
        var squaredSum = 0.0
        for sample in samples {
            let value = Double(sample) - mean
            centered.append(value)
            squaredSum += value * value
        }

        let rms = sqrt(squaredSum / Double(centered.count))
        guard rms >= minimumRMS else { return nil }

        // Use the same number of comparisons for every lag. This avoids a
        // systematic preference for large lags near the end of the buffer.
        let comparisonCount = min(centered.count / 2, centered.count - maximumTau)
        guard comparisonCount > maximumTau else { return nil }

        var difference = [Double](repeating: 0.0, count: maximumTau + 1)
        if maximumTau >= 1 {
            for tau in 1...maximumTau {
                var sum = 0.0
                for index in 0..<comparisonCount {
                    let delta = centered[index] - centered[index + tau]
                    sum += delta * delta
                }
                difference[tau] = sum
            }
        }

        var normalized = [Double](repeating: 1.0, count: maximumTau + 1)
        var runningSum = 0.0
        if maximumTau >= 1 {
            for tau in 1...maximumTau {
                runningSum += difference[tau]
                normalized[tau] = runningSum > 0
                    ? difference[tau] * Double(tau) / runningSum
                    : 1.0
            }
        }

        var candidateTau: Int?
        var tau = minimumTau
        while tau <= maximumTau {
            if normalized[tau] < threshold {
                while tau + 1 <= maximumTau,
                      normalized[tau + 1] < normalized[tau] {
                    tau += 1
                }
                candidateTau = tau
                break
            }
            tau += 1
        }

        guard let candidateTau else { return nil }
        let refinedTau = parabolicInterpolation(
            values: normalized,
            index: candidateTau
        )
        guard refinedTau.isFinite, refinedTau > 0 else { return nil }

        let frequencyHz = sampleRateHz / refinedTau
        guard frequencyHz.isFinite,
              frequencyHz >= minimumFrequencyHz,
              frequencyHz <= maximumFrequencyHz else {
            return nil
        }

        let confidence = min(1.0, max(0.0, 1.0 - normalized[candidateTau]))
        return PitchEstimate(
            frequencyHz: frequencyHz,
            confidence: confidence,
            rms: rms
        )
    }

    private func parabolicInterpolation(
        values: [Double],
        index: Int
    ) -> Double {
        guard index > 0, index + 1 < values.count else {
            return Double(index)
        }

        let left = values[index - 1]
        let center = values[index]
        let right = values[index + 1]
        let denominator = left - 2.0 * center + right
        guard abs(denominator) > .ulpOfOne else {
            return Double(index)
        }

        let offset = 0.5 * (left - right) / denominator
        return Double(index) + min(1.0, max(-1.0, offset))
    }
}

