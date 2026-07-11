import Foundation
import Metal

final class Benchmark {
    private let device: MTLDevice
    private let queue: MTLCommandQueue
    private let uniformPSO: MTLComputePipelineState
    private let divergentPSO: MTLComputePipelineState

    init() throws {
        guard let d = MTLCreateSystemDefaultDevice() else {
            throw NSError(domain: "SIMTBenchmark", code: 1, userInfo: [NSLocalizedDescriptionKey: "No Metal device found"]) }
        device = d

        guard let q = d.makeCommandQueue() else {
            throw NSError(domain: "SIMTBenchmark", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create command queue"]) }
        queue = q

        let metalSource = try Benchmark.loadKernelSource()
        let lib = try d.makeLibrary(source: metalSource, options: nil)
        guard let uniformFn = lib.makeFunction(name: "uniformKernel"),
              let divergentFn = lib.makeFunction(name: "divergentKernel") else {
            throw NSError(domain: "SIMTBenchmark", code: 3, userInfo: [NSLocalizedDescriptionKey: "Kernel symbols not found"]) }

        uniformPSO = try d.makeComputePipelineState(function: uniformFn)
        divergentPSO = try d.makeComputePipelineState(function: divergentFn)
    }

    private static func loadKernelSource() throws -> String {
        if let bundleURL = Bundle.module.url(forResource: "Kernels", withExtension: "metal") {
            return try String(contentsOf: bundleURL, encoding: .utf8)
        }

        throw NSError(domain: "SIMTBenchmark", code: 4, userInfo: [NSLocalizedDescriptionKey: "Could not locate Kernels.metal"])
    }

    func runGPU(n: Int, k: Int, m: Int, divergent: Bool, repeats: Int, warmups: Int, tpg: Int) throws -> Stats {
        let input = (0..<n).map { Float($0 % 251) * 0.01 }

        let byteCount = MemoryLayout<Float>.stride * n
        let inBuf = input.withUnsafeBytes { raw in
            device.makeBuffer(bytes: raw.baseAddress!, length: byteCount, options: .storageModeShared)
        }

        guard let inBuf,
              let outBuf = device.makeBuffer(length: byteCount, options: .storageModeShared) else {
            throw NSError(domain: "SIMTBenchmark", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to allocate buffers"]) }

        var nU = UInt32(n)
        var kU = UInt32(k)
        var mU = UInt32(max(m, 1))

        let pso = divergent ? divergentPSO : uniformPSO
        let tg = MTLSize(width: tpg, height: 1, depth: 1)
        let grid = MTLSize(width: n, height: 1, depth: 1)

        func oneRun() throws -> Double {
            guard let cmd = queue.makeCommandBuffer(),
                  let enc = cmd.makeComputeCommandEncoder() else {
                throw NSError(domain: "SIMTBenchmark", code: 6, userInfo: [NSLocalizedDescriptionKey: "Failed to create command buffer/encoder"]) }

            enc.setComputePipelineState(pso)
            enc.setBuffer(inBuf, offset: 0, index: 0)
            enc.setBuffer(outBuf, offset: 0, index: 1)
            enc.setBytes(&nU, length: MemoryLayout<UInt32>.stride, index: 2)
            enc.setBytes(&kU, length: MemoryLayout<UInt32>.stride, index: 3)
            if divergent {
                enc.setBytes(&mU, length: MemoryLayout<UInt32>.stride, index: 4)
            }
            enc.dispatchThreads(grid, threadsPerThreadgroup: tg)
            enc.endEncoding()

            cmd.commit()
            cmd.waitUntilCompleted()

            let s = cmd.gpuStartTime
            let e = cmd.gpuEndTime
            if e <= s {
                throw NSError(domain: "SIMTBenchmark", code: 7, userInfo: [NSLocalizedDescriptionKey: "GPU timestamps unavailable"]) }
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

        let mMs = mean(samples)
        return Stats(meanMs: mMs, stdMs: stddev(samples, mean: mMs))
    }
}
