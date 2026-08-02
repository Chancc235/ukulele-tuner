import Darwin
import Foundation
import UkeTuneCore

private struct CheckSuite {
    private(set) var failures: [String] = []

    mutating func expect(
        _ condition: @autoclosure () -> Bool,
        _ message: String
    ) {
        if !condition() {
            failures.append(message)
        }
    }
}

private let sampleRateHz = 48_000.0
private let sampleCount = 4_096

private func makeSignal(
    frequencyHz: Double,
    harmonics: [(multiple: Int, amplitude: Double)]
) -> [Float] {
    (0..<sampleCount).map { index in
        let time = Double(index) / sampleRateHz
        let value = harmonics.reduce(0.0) { partial, harmonic in
            partial + harmonic.amplitude * sin(
                2.0 * .pi * frequencyHz * Double(harmonic.multiple) * time
            )
        }
        return Float(value)
    }
}

private func runChecks() -> [String] {
    var suite = CheckSuite()
    let detector = YINPitchDetector()

    suite.expect(abs(UkuleleString.g4.frequencyHz - 391.995_436) < 0.000_001, "G4 frequency")
    suite.expect(abs(UkuleleString.c4.frequencyHz - 261.625_565) < 0.000_001, "C4 frequency")
    suite.expect(abs(UkuleleString.e4.frequencyHz - 329.627_557) < 0.000_001, "E4 frequency")
    suite.expect(abs(UkuleleString.a4.frequencyHz - 440.0) < 0.000_001, "A4 frequency")

    for target in UkuleleString.allCases {
        let estimate = detector.estimatePitch(
            samples: makeSignal(
                frequencyHz: target.frequencyHz,
                harmonics: [(1, 0.8)]
            ),
            sampleRateHz: sampleRateHz
        )
        suite.expect(estimate != nil, "\(target.rawValue) should be detected")

        if let estimate,
           let error = TuningMath.cents(
               detectedFrequencyHz: estimate.frequencyHz,
               targetFrequencyHz: target.frequencyHz
           ) {
            suite.expect(abs(error) <= 0.5, "\(target.rawValue) error was \(error) cents")
            suite.expect(estimate.confidence > 0.8, "\(target.rawValue) confidence")
        }
    }

    let a4 = UkuleleString.a4.frequencyHz
    let tenCentsHigh = a4 * pow(2.0, 10.0 / 1_200.0)
    if let estimate = detector.estimatePitch(
        samples: makeSignal(frequencyHz: tenCentsHigh, harmonics: [(1, 0.8)]),
        sampleRateHz: sampleRateHz
    ), let cents = TuningMath.cents(
        detectedFrequencyHz: estimate.frequencyHz,
        targetFrequencyHz: a4
    ) {
        suite.expect(abs(cents - 10.0) <= 0.75, "+10 cents estimate was \(cents)")
    } else {
        suite.expect(false, "+10 cents A4 should be detected")
    }

    let c4 = UkuleleString.c4.frequencyHz
    if let estimate = detector.estimatePitch(
        samples: makeSignal(
            frequencyHz: c4,
            harmonics: [(1, 0.25), (2, 0.60), (3, 0.15)]
        ),
        sampleRateHz: sampleRateHz
    ), let cents = TuningMath.cents(
        detectedFrequencyHz: estimate.frequencyHz,
        targetFrequencyHz: c4
    ) {
        suite.expect(abs(cents) <= 0.75, "Strong second harmonic caused \(cents) cents error")
    } else {
        suite.expect(false, "Strong second harmonic signal should be detected")
    }

    let lowEstimate = PitchEstimate(frequencyHz: 438.0, confidence: 0.95, rms: 0.2)
    if let result = TuningMath.result(from: lowEstimate) {
        suite.expect(result.target == .a4, "438 Hz should match A4")
        suite.expect(result.direction == .tooLow, "438 Hz should be low")
    } else {
        suite.expect(false, "438 Hz should produce a tuning result")
    }

    suite.expect(
        detector.estimatePitch(
            samples: [Float](repeating: 0, count: sampleCount),
            sampleRateHz: sampleRateHz
        ) == nil,
        "Silence should be rejected"
    )
    suite.expect(
        TuningMath.cents(detectedFrequencyHz: .nan, targetFrequencyHz: 440) == nil,
        "NaN should be rejected"
    )

    return suite.failures
}

let failures = runChecks()
if failures.isEmpty {
    print("UkeTuneCoreChecks: all checks passed")
    exit(EXIT_SUCCESS)
}

for failure in failures {
    fputs("FAIL: \(failure)\n", stderr)
}
fputs("UkeTuneCoreChecks: \(failures.count) failure(s)\n", stderr)
exit(EXIT_FAILURE)

