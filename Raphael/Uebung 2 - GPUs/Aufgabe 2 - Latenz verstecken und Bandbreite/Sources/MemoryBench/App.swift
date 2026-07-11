import Foundation

func runApp() throws {
    let cfg = parseCLI()

    if cfg.mode == "help" || cfg.mode == "--help" {
        printUsage()
        return
    }

    guard cfg.n > 0 else {
        throw NSError(domain: "MemoryBench", code: 20, userInfo: [NSLocalizedDescriptionKey: "n must be > 0"])
    }

    let bench = try MemoryBenchmark()
    var rows: [Row] = []

    switch cfg.mode {
    case "sweep":
        for tpg in cfg.tpgList {
            for pattern in AccessPattern.allCases {
                let row = try bench.run(
                    pattern: pattern,
                    n: cfg.n,
                    stride: cfg.stride,
                    tpg: tpg,
                    repeats: cfg.repeats,
                    warmups: cfg.warmups
                )
                rows.append(row)
            }
        }
    case "coalesced", "stride", "gather":
        guard let pattern = AccessPattern(rawValue: cfg.mode) else {
            throw NSError(domain: "MemoryBench", code: 21, userInfo: [NSLocalizedDescriptionKey: "Invalid mode \(cfg.mode)"])
        }
        for tpg in cfg.tpgList {
            let row = try bench.run(
                pattern: pattern,
                n: cfg.n,
                stride: cfg.stride,
                tpg: tpg,
                repeats: cfg.repeats,
                warmups: cfg.warmups
            )
            rows.append(row)
        }
    default:
        printUsage()
        return
    }

    let empiricalPeak = rows.filter { $0.pattern == .coalesced }.map { $0.gbps }.max() ?? 0.0

    for r in rows {
        let ratioInput = cfg.peakGBps.map { r.gbps / $0 } ?? -1.0
        let ratioEmp = empiricalPeak > 0 ? (r.gbps / empiricalPeak) : -1.0

        let row = "\(r.pattern.rawValue),\(r.n),\(r.stride),\(r.tpg),\(r.tew),\(r.maxTPG),\(String(format: "%.4f", r.occProxy)),\(String(format: "%.4f", r.meanMs)),\(String(format: "%.4f", r.stdMs)),\(String(format: "%.3f", r.gbps)),\(String(format: "%.4f", ratioInput)),\(String(format: "%.4f", ratioEmp))"
        try appendCSV(path: cfg.csvPath, line: row)
        print(row)
    }

    if let peak = cfg.peakGBps {
        print("Input peak bandwidth: \(peak) GB/s")
    }
    print("Empirical coalesced peak: \(String(format: "%.3f", empiricalPeak)) GB/s")
}
