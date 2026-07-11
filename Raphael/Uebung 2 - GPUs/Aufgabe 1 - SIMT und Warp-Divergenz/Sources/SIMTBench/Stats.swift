import Foundation

struct Stats {
    let meanMs: Double
    let stdMs: Double
}

func mean(_ values: [Double]) -> Double {
    values.reduce(0, +) / Double(values.count)
}

func stddev(_ values: [Double], mean m: Double) -> Double {
    if values.count < 2 { return 0 }
    let v = values.reduce(0) { $0 + (($1 - m) * ($1 - m)) } / Double(values.count - 1)
    return sqrt(v)
}

func gflops(n: Int, k: Int, flopsPerIter: Int, ms: Double) -> Double {
    let sec = ms / 1000.0
    let flops = Double(n) * Double(k) * Double(flopsPerIter)
    return flops / sec / 1e9
}
