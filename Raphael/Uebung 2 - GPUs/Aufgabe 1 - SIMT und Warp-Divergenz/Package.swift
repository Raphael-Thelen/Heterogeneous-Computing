// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SIMTBenchmark",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "simt-bench", targets: ["SIMTBench"])
    ],
    targets: [
        .executableTarget(
            name: "SIMTBench",
            path: "Sources/SIMTBench",
            resources: [
                .copy("Kernels.metal")
            ]
        )
    ]
)
