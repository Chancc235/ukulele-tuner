import Foundation

/// The four courses in standard high-G ukulele tuning.
public enum UkuleleString: String, CaseIterable, Codable, Sendable {
    case g4 = "G4"
    case c4 = "C4"
    case e4 = "E4"
    case a4 = "A4"

    /// Physical string position, where 1 is the string nearest the floor
    /// while holding the instrument in playing position.
    public var position: Int {
        switch self {
        case .g4: 4
        case .c4: 3
        case .e4: 2
        case .a4: 1
        }
    }

    public var frequencyHz: Double {
        switch self {
        case .g4: 391.995_436
        case .c4: 261.625_565
        case .e4: 329.627_557
        case .a4: 440.0
        }
    }
}

public struct TuningConfiguration: Equatable, Sendable {
    public let targets: [UkuleleString]
    public let inTuneToleranceCents: Double
    public let maximumAutoMatchDistanceCents: Double

    public init(
        targets: [UkuleleString],
        inTuneToleranceCents: Double,
        maximumAutoMatchDistanceCents: Double
    ) {
        self.targets = targets
        self.inTuneToleranceCents = inTuneToleranceCents
        self.maximumAutoMatchDistanceCents = maximumAutoMatchDistanceCents
    }

    public static let standardHighG = TuningConfiguration(
        targets: [.g4, .c4, .e4, .a4],
        inTuneToleranceCents: 5.0,
        maximumAutoMatchDistanceCents: 250.0
    )
}

public enum TuningDirection: String, Equatable, Sendable {
    case tooLow
    case inTune
    case tooHigh
}

public struct TuningResult: Equatable, Sendable {
    public let target: UkuleleString
    public let detectedFrequencyHz: Double
    public let cents: Double
    public let direction: TuningDirection
    public let confidence: Double

    public init(
        target: UkuleleString,
        detectedFrequencyHz: Double,
        cents: Double,
        direction: TuningDirection,
        confidence: Double
    ) {
        self.target = target
        self.detectedFrequencyHz = detectedFrequencyHz
        self.cents = cents
        self.direction = direction
        self.confidence = confidence
    }
}

public struct PitchEstimate: Equatable, Sendable {
    public let frequencyHz: Double
    public let confidence: Double
    public let rms: Double

    public init(frequencyHz: Double, confidence: Double, rms: Double) {
        self.frequencyHz = frequencyHz
        self.confidence = confidence
        self.rms = rms
    }
}

public protocol PitchDetecting: Sendable {
    func estimatePitch(samples: [Float], sampleRateHz: Double) -> PitchEstimate?
}

