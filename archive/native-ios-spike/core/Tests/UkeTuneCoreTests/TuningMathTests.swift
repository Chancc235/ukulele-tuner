import Foundation
import Testing
@testable import UkeTuneCore

@Suite("Tuning math")
struct TuningMathTests {
    @Test("Standard high-G frequencies match the product specification")
    func standardHighGFrequencies() {
        #expect(abs(UkuleleString.g4.frequencyHz - 391.995_436) < 0.000_001)
        #expect(abs(UkuleleString.c4.frequencyHz - 261.625_565) < 0.000_001)
        #expect(abs(UkuleleString.e4.frequencyHz - 329.627_557) < 0.000_001)
        #expect(abs(UkuleleString.a4.frequencyHz - 440.0) < 0.000_001)
    }

    @Test("Cents are signed and reversible")
    func centsAreSignedAndReversible() throws {
        let target = 440.0
        let tenCentsHigh = target * pow(2.0, 10.0 / 1_200.0)
        let tenCentsLow = target * pow(2.0, -10.0 / 1_200.0)
        let highResult = try #require(TuningMath.cents(
            detectedFrequencyHz: tenCentsHigh,
            targetFrequencyHz: target
        ))
        let lowResult = try #require(TuningMath.cents(
            detectedFrequencyHz: tenCentsLow,
            targetFrequencyHz: target
        ))

        #expect(abs(highResult - 10.0) < 0.000_001)
        #expect(abs(lowResult + 10.0) < 0.000_001)
    }

    @Test("Invalid frequencies are rejected")
    func invalidFrequenciesReturnNil() {
        #expect(TuningMath.cents(detectedFrequencyHz: 0, targetFrequencyHz: 440) == nil)
        #expect(TuningMath.cents(detectedFrequencyHz: .nan, targetFrequencyHz: 440) == nil)
        #expect(TuningMath.cents(detectedFrequencyHz: 440, targetFrequencyHz: -.infinity) == nil)
    }

    @Test("Automatic target selection reports the correct direction")
    func automaticTargetAndDirection() throws {
        let estimate = PitchEstimate(frequencyHz: 438.0, confidence: 0.95, rms: 0.2)
        let result = try #require(TuningMath.result(from: estimate))

        #expect(result.target == .a4)
        #expect(result.direction == .tooLow)
        #expect(result.cents < -5.0)
    }

    @Test("The in-tune tolerance includes both boundaries", arguments: [-5.0, 0.0, 5.0])
    func inTuneToleranceIsInclusive(offset: Double) throws {
        let frequency = UkuleleString.c4.frequencyHz * pow(2.0, offset / 1_200.0)
        let estimate = PitchEstimate(frequencyHz: frequency, confidence: 1.0, rms: 0.2)
        let result = try #require(TuningMath.result(from: estimate))

        #expect(result.direction == .inTune)
    }

    @Test("Manual mode never switches the locked string")
    func manualTargetDoesNotSwitchStrings() throws {
        let estimate = PitchEstimate(
            frequencyHz: UkuleleString.e4.frequencyHz,
            confidence: 0.9,
            rms: 0.2
        )
        let result = try #require(TuningMath.result(
            from: estimate,
            lockedTarget: .c4
        ))

        #expect(result.target == .c4)
        #expect(result.direction == .tooHigh)
    }
}

