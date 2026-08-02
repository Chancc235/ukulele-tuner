// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "UkeTuneCore",
    platforms: [
        .iOS(.v26),
        .macOS(.v15)
    ],
    products: [
        .library(name: "UkeTuneCore", targets: ["UkeTuneCore"]),
        .executable(name: "UkeTuneCoreChecks", targets: ["UkeTuneCoreChecks"])
    ],
    targets: [
        .target(name: "UkeTuneCore"),
        .executableTarget(
            name: "UkeTuneCoreChecks",
            dependencies: ["UkeTuneCore"]
        ),
        .testTarget(
            name: "UkeTuneCoreTests",
            dependencies: ["UkeTuneCore"]
        )
    ]
)
