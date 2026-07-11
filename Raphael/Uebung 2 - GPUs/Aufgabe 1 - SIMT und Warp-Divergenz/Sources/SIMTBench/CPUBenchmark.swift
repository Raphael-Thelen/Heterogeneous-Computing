import Foundation

@inline(never) private func mix0(_ x: Float) -> Float { 1.000123 * x + 0.101 }
@inline(never) private func mix1(_ x: Float) -> Float { 0.999987 * x + 0.202 }
@inline(never) private func mix2(_ x: Float) -> Float { 1.000311 * x + 0.303 }
@inline(never) private func mix3(_ x: Float) -> Float { 0.999731 * x + 0.404 }
@inline(never) private func mix4(_ x: Float) -> Float { 1.000451 * x + 0.505 }
@inline(never) private func mix5(_ x: Float) -> Float { 0.999521 * x + 0.606 }
@inline(never) private func mix6(_ x: Float) -> Float { 1.000271 * x + 0.707 }
@inline(never) private func mix7(_ x: Float) -> Float { 0.999401 * x + 0.808 }

func runCPU(n: Int, k: Int, m: Int, divergent: Bool, repeats: Int, warmups: Int) -> Stats {
    let input = (0..<n).map { Float($0 % 251) * 0.01 }
    var output = Array(repeating: Float.zero, count: n)

    func oneRun() -> Double {
        let t0 = DispatchTime.now().uptimeNanoseconds

        input.withUnsafeBufferPointer { inPtr in
            output.withUnsafeMutableBufferPointer { outPtr in
                DispatchQueue.concurrentPerform(iterations: n) { i in
                    var x = inPtr[i]
                    if divergent {
                        let branch = i % max(m, 1)
                        for _ in 0..<k {
                            switch branch & 7 {
                            case 0: x = mix0(x)
                            case 1: x = mix1(x)
                            case 2: x = mix2(x)
                            case 3: x = mix3(x)
                            case 4: x = mix4(x)
                            case 5: x = mix5(x)
                            case 6: x = mix6(x)
                            default: x = mix7(x)
                            }
                            x = 0.99991 * x + 0.123
                        }
                    } else {
                        for _ in 0..<k {
                            x = 1.000123 * x + 0.99991
                            x = 0.314159 * x + 0.271828
                        }
                    }
                    outPtr[i] = x
                }
            }
        }

        let t1 = DispatchTime.now().uptimeNanoseconds
        return Double(t1 - t0) / 1e6
    }

    for _ in 0..<warmups {
        _ = oneRun()
    }

    var samples: [Double] = []
    samples.reserveCapacity(repeats)
    for _ in 0..<repeats {
        samples.append(oneRun())
    }

    let mMs = mean(samples)
    return Stats(meanMs: mMs, stdMs: stddev(samples, mean: mMs))
}
