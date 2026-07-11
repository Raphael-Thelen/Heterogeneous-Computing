import Foundation

func runApp() throws {
    let cfg = parseCLI()
    if cfg.mode == "help" || cfg.mode == "--help" {
        printUsage()
        return
    }

    let flopsPerIter = 4

    if cfg.mode == "sweep" {
        let bench = try Benchmark()

        let nValues = (10...24).map { 1 << $0 }
        for n in nValues {
            let gpuUniform = try bench.runGPU(n: n, k: cfg.k, m: 1, divergent: false, repeats: cfg.repeats, warmups: cfg.warmups, tpg: cfg.threadsPerGroup)
            let gflopU = gflops(n: n, k: cfg.k, flopsPerIter: flopsPerIter, ms: gpuUniform.meanMs)
            let rowU = "gpu_uniform,\(n),\(cfg.k),1,\(cfg.threadsPerGroup),\(String(format: "%.4f", gpuUniform.meanMs)),\(String(format: "%.4f", gpuUniform.stdMs)),\(String(format: "%.3f", gflopU))"
            try appendCSV(path: cfg.csvPath, line: rowU)
            print(rowU)
        }

        let mValues = [1, 2, 4, 8, 16, 32]
        let nFixed = 1 << 22
        for m in mValues {
            let gpuDiv = try bench.runGPU(n: nFixed, k: cfg.k, m: m, divergent: true, repeats: cfg.repeats, warmups: cfg.warmups, tpg: cfg.threadsPerGroup)
            let gflopD = gflops(n: nFixed, k: cfg.k, flopsPerIter: flopsPerIter, ms: gpuDiv.meanMs)
            let rowD = "gpu_divergent,\(nFixed),\(cfg.k),\(m),\(cfg.threadsPerGroup),\(String(format: "%.4f", gpuDiv.meanMs)),\(String(format: "%.4f", gpuDiv.stdMs)),\(String(format: "%.3f", gflopD))"
            try appendCSV(path: cfg.csvPath, line: rowD)
            print(rowD)
        }

        print("Wrote results to \(cfg.csvPath)")
        return
    }

    switch cfg.mode {
    case "gpu-uniform", "gpu-divergent":
        let bench = try Benchmark()
        let divergent = (cfg.mode == "gpu-divergent")
        let st = try bench.runGPU(n: cfg.n, k: cfg.k, m: cfg.m, divergent: divergent, repeats: cfg.repeats, warmups: cfg.warmups, tpg: cfg.threadsPerGroup)
        let perf = gflops(n: cfg.n, k: cfg.k, flopsPerIter: flopsPerIter, ms: st.meanMs)
        let row = "\(cfg.mode),\(cfg.n),\(cfg.k),\(cfg.m),\(cfg.threadsPerGroup),\(String(format: "%.4f", st.meanMs)),\(String(format: "%.4f", st.stdMs)),\(String(format: "%.3f", perf))"
        try appendCSV(path: cfg.csvPath, line: row)
        print(row)
    case "cpu-uniform", "cpu-divergent":
        let divergent = (cfg.mode == "cpu-divergent")
        let st = runCPU(n: cfg.n, k: cfg.k, m: cfg.m, divergent: divergent, repeats: cfg.repeats, warmups: cfg.warmups)
        let perf = gflops(n: cfg.n, k: cfg.k, flopsPerIter: flopsPerIter, ms: st.meanMs)
        let row = "\(cfg.mode),\(cfg.n),\(cfg.k),\(cfg.m),\(cfg.threadsPerGroup),\(String(format: "%.4f", st.meanMs)),\(String(format: "%.4f", st.stdMs)),\(String(format: "%.3f", perf))"
        try appendCSV(path: cfg.csvPath, line: row)
        print(row)
    default:
        printUsage()
    }
}
