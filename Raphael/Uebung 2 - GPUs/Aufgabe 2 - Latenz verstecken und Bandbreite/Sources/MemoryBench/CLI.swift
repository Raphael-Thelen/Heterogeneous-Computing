import Foundation

struct CLI {
    var mode: String = "sweep"
    var n: Int = 1 << 24
    var repeats: Int = 10
    var warmups: Int = 3
    var stride: Int = 16
    var tpgList: [Int] = [32, 64, 128, 256, 512]
    var peakGBps: Double? = nil
    var csvPath: String = "results.csv"
}

func parseCLI() -> CLI {
    var cfg = CLI()
    var args = CommandLine.arguments
    args.removeFirst()

    func takeValue(_ i: inout Int) -> String? {
        guard i + 1 < args.count else { return nil }
        i += 1
        return args[i]
    }

    var i = 0
    while i < args.count {
        switch args[i] {
        case "--mode":
            if let v = takeValue(&i) { cfg.mode = v }
        case "--n":
            if let v = takeValue(&i), let x = Int(v) { cfg.n = x }
        case "--repeats":
            if let v = takeValue(&i), let x = Int(v) { cfg.repeats = x }
        case "--warmups":
            if let v = takeValue(&i), let x = Int(v) { cfg.warmups = x }
        case "--stride":
            if let v = takeValue(&i), let x = Int(v) { cfg.stride = x }
        case "--tpg-list":
            if let v = takeValue(&i) {
                cfg.tpgList = v.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
            }
        case "--peak-gbps":
            if let v = takeValue(&i), let x = Double(v) { cfg.peakGBps = x }
        case "--csv":
            if let v = takeValue(&i) { cfg.csvPath = v }
        default:
            break
        }
        i += 1
    }

    if cfg.tpgList.isEmpty {
        cfg.tpgList = [32, 64, 128, 256, 512]
    }

    return cfg
}

func printUsage() {
    let txt = """
Usage:
  swift run memory-bench --mode sweep --n 16777216 --stride 16 --tpg-list 32,64,128,256,512 --repeats 10 --warmups 3 --peak-gbps 68.25 --csv results.csv

Notes:
  --peak-gbps is optional. For Apple M1, a common theoretical value is ~68.25 GB/s.
"""
    print(txt)
}
