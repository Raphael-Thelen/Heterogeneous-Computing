// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MemoryBench",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "memory-bench", targets: ["MemoryBench"])
    ],
    targets: [
        .executableTarget(
            name: "MemoryBench",
            path: "Sources/MemoryBench",
            resources: [
                .copy("Kernels.metal")
            ]
        )
    ]
)
