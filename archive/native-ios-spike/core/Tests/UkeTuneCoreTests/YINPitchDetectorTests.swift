import Foundation
import Testing
@testable import UkeTuneCore

@Suite("YIN pitch detector")
struct YINPitchDetectorTests {
    private let sampleRateHz = 48_000.0
    private let sampleCount = 4_096

    @Test("Detects every standard high-G string", arguments: UkuleleString.allCases)
    func detectsEveryStandardString(target: UkuleleString) throws {
        let detector = YINPitchDetector()
        let samples = makeSignal(
            frequencyHz: target.frequencyHz,
            harmonics: [(1, 0.8)]
        )
        let estimate = try #require(detector.estimatePitch(
            samples: samples,
            sampleRateHz: sampleRateHz
        ))
        let error = try #require(TuningMath.cents(
            detectedFrequencyHz: estimate.frequencyHz,
            targetFrequencyHz: target.frequencyHz
        ))

        #expect(abs(error) <= 0.5, "Failed for \(target.rawValue)")
        #expect(estimate.confidence > 0.8)
    }

    @Test("Detects a signal ten cents high")
    func detectsTenCentsHigh() throws {
        let detector = YINPitchDetector()
        let target = UkuleleString.a4.frequencyHz
        let frequency = target * pow(2.0, 10.0 / 1_200.0)
        let estimate = try #require(detector.estimatePitch(
            samples: makeSignal(frequencyHz: frequency, harmonics: [(1, 0.8)]),
            sampleRateHz: sampleRateHz
        ))
        let cents = try #require(TuningMath.cents(
            detectedFrequencyHz: estimate.frequencyHz,
            targetFrequencyHz: target
        ))

        #expect(abs(cents - 10.0) <= 0.75)
    }

    @Test("A strong second harmonic does not cause an octave error")
    func strongSecondHarmonicDoesNotCauseOctaveError() throws {
        let detector = YINPitchDetector()
        let target = UkuleleString.c4.frequencyHz
        let samples = makeSignal(
            frequencyHz: target,
            harmonics: [(1, 0.25), (2, 0.60), (3, 0.15)]
        )
        let estimate = try #require(detector.estimatePitch(
            samples: samples,
            sampleRateHz: sampleRateHz
        ))
        let cents = try #require(TuningMath.cents(
            detectedFrequencyHz: estimate.frequencyHz,
            targetFrequencyHz: target
        ))

        #expect(abs(cents) <= 0.75)
    }

    @Test("Silence and invalid input are rejected")
    func silenceAndInvalidInputReturnNil() {
        let detector = YINPitchDetector()

        #expect(detector.estimatePitch(
            samples: [Float](repeating: 0, count: sampleCount),
            sampleRateHz: sampleRateHz
        ) == nil)
        #expect(detector.estimatePitch(
            samples: [0, 0, 0],
            sampleRateHz: sampleRateHz
        ) == nil)
        #expect(detector.estimatePitch(
            samples: [Float](repeating: 0.5, count: sampleCount),
            sampleRateHz: 0
        ) == nil)
    }

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
}

