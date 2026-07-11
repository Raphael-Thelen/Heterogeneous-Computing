import Foundation
import Metal

enum AccessPattern: String, CaseIterable {
    case coalesced
    case stride
    case gather
}

struct Row {
    let pattern: AccessPattern
    let n: Int
    let stride: Int
    let tpg: Int
    let tew: Int
    let maxTPG: Int
    let occProxy: Double
    let meanMs: Double
    let stdMs: Double
    let gbps: Double
}

final class MemoryBenchmark {
    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private let coalescedPSO: MTLComputePipelineState
    private let stridePSO: MTLComputePipelineState
    private let gatherPSO: MTLComputePipelineState

    init() throws {
        guard let d = MTLCreateSystemDefaultDevice() else {
            throw NSError(domain: "MemoryBench", code: 1, userInfo: [NSLocalizedDescriptionKey: "No Metal device found"]) }
        device = d

        guard let q = d.makeCommandQueue() else {
            throw NSError(domain: "MemoryBench", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create command queue"]) }
        queue = q

        let src = try Self.loadKernelSource()
        let lib = try d.makeLibrary(source: src, options: nil)

        guard let f0 = lib.makeFunction(name: "coalescedKernel"),
              let f1 = lib.makeFunction(name: "strideKernel"),
              let f2 = lib.makeFunction(name: "gatherKernel") else {
            throw NSError(domain: "MemoryBench", code: 3, userInfo: [NSLocalizedDescriptionKey: "Kernel symbols not found"]) }

        coalescedPSO = try d.makeComputePipelineState(function: f0)
        stridePSO = try d.makeComputePipelineState(function: f1)
        gatherPSO = try d.makeComputePipelineState(function: f2)
    }

    private static func loadKernelSource() throws -> String {
        if let bundleURL = Bundle.module.url(forResource: "Kernels", withExtension: "metal") {
            return try String(contentsOf: bundleURL, encoding: .utf8)
        }
        throw NSError(domain: "MemoryBench", code: 4, userInfo: [NSLocalizedDescriptionKey: "Could not locate Kernels.metal"])
    }

    private func shuffledIndices(count: Int) -> [UInt32] {
        var rng = SeededGenerator(seed: 0xA5A5A5A5)
        var arr = Array(0..<count).map { UInt32($0) }
        arr.shuffle(using: &rng)
        return arr
    }

    func run(pattern: AccessPattern, n: Int, stride: Int, tpg: Int, repeats: Int, warmups: Int) throws -> Row {
        let input = (0..<n).map { Float($0 % 1021) * 0.001 }
        let indices = pattern == .gather ? shuffledIndices(count: n) : []

        let byteCountF = MemoryLayout<Float>.stride * n
        let inBuf = input.withUnsafeBytes { raw in
            device.makeBuffer(bytes: raw.baseAddress!, length: byteCountF, options: .storageModeShared)
        }
        let idxBuf = indices.withUnsafeBytes { raw in
            raw.baseAddress == nil ? nil : device.makeBuffer(bytes: raw.baseAddress!, length: MemoryLayout<UInt32>.stride * n, options: .storageModeShared)
        }

        guard let inBuf,
              let outBuf = device.makeBuffer(length: byteCountF, options: .storageModeShared) else {
            throw NSError(domain: "MemoryBench", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to allocate buffers"]) }

        let pso: MTLComputePipelineState
        switch pattern {
        case .coalesced: pso = coalescedPSO
        case .stride: pso = stridePSO
        case .gather: pso = gatherPSO
        }

        let maxTPG = pso.maxTotalThreadsPerThreadgroup
        if tpg > maxTPG {
            throw NSError(domain: "MemoryBench", code: 6, userInfo: [NSLocalizedDescriptionKey: "tpg \(tpg) exceeds max \(maxTPG) for \(pattern.rawValue)"])
        }

        var nU = UInt32(n)
        var strideU = UInt32(max(1, stride))
        var scale: Float = 1.0001

        let tew = max(1, pso.threadExecutionWidth)
        let activeSIMD = (tpg + tew - 1) / tew
        let maxSIMD = max(1, maxTPG / tew)
        let occProxy = Double(activeSIMD) / Double(maxSIMD)

        let tg = MTLSize(width: tpg, height: 1, depth: 1)
        let grid = MTLSize(width: n, height: 1, depth: 1)

        func oneRun() throws -> Double {
            guard let cmd = queue.makeCommandBuffer(), let enc = cmd.makeComputeCommandEncoder() else {
                throw NSError(domain: "MemoryBench", code: 7, userInfo: [NSLocalizedDescriptionKey: "Failed to create command encoder"]) }

            enc.setComputePipelineState(pso)
            switch pattern {
            case .coalesced:
                enc.setBuffer(inBuf, offset: 0, index: 0)
                enc.setBuffer(outBuf, offset: 0, index: 1)
                enc.setBytes(&nU, length: MemoryLayout<UInt32>.stride, index: 2)
                enc.setBytes(&scale, length: MemoryLayout<Float>.stride, index: 3)
            case .stride:
                enc.setBuffer(inBuf, offset: 0, index: 0)
                enc.setBuffer(outBuf, offset: 0, index: 1)
                enc.setBytes(&nU, length: MemoryLayout<UInt32>.stride, index: 2)
                enc.setBytes(&strideU, length: MemoryLayout<UInt32>.stride, index: 3)
                enc.setBytes(&scale, length: MemoryLayout<Float>.stride, index: 4)
            case .gather:
                guard let idxBuf else {
                    throw NSError(domain: "MemoryBench", code: 8, userInfo: [NSLocalizedDescriptionKey: "Gather index buffer missing"])
                }
                enc.setBuffer(inBuf, offset: 0, index: 0)
                enc.setBuffer(outBuf, offset: 0, index: 1)
                enc.setBuffer(idxBuf, offset: 0, index: 2)
                enc.setBytes(&nU, length: MemoryLayout<UInt32>.stride, index: 3)
                enc.setBytes(&scale, length: MemoryLayout<Float>.stride, index: 4)
            }

            enc.dispatchThreads(grid, threadsPerThreadgroup: tg)
            enc.endEncoding()

            cmd.commit()
            cmd.waitUntilCompleted()

            let s = cmd.gpuStartTime
            let e = cmd.gpuEndTime
            if e <= s {
                throw NSError(domain: "MemoryBench", code: 9, userInfo: [NSLocalizedDescriptionKey: "GPU timestamps unavailable"])
            }
            return (e - s) * 1000.0
        }

        for _ in 0..<warmups {
            _ = try oneRun()
        }

        var samples: [Double] = []
        samples.reserveCapacity(repeats)
        for _ in 0..<repeats {
            samples.append(try oneRun())
        }

        let meanMs = mean(samples)
        let stdMs = stddev(samples, mean: meanMs)

        let bytesPerElement: Double = (pattern == .gather) ? 12.0 : 8.0
        let totalBytes = Double(n) * bytesPerElement
        let gbps = totalBytes / (meanMs / 1000.0) / 1e9

        return Row(
            pattern: pattern,
            n: n,
            stride: stride,
            tpg: tpg,
            tew: tew,
            maxTPG: maxTPG,
            occProxy: occProxy,
            meanMs: meanMs,
            stdMs: stdMs,
            gbps: gbps
        )
    }
}

struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { self.state = seed }

    mutating func next() -> UInt64 {
        state = 6364136223846793005 &* state &+ 1
        return state
    }
}
