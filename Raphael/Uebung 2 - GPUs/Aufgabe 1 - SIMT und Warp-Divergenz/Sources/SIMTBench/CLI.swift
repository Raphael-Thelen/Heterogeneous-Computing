import Foundation

struct CLI {
    var mode: String = "sweep"
    var n: Int = 1 << 20
    var k: Int = 2048
    var m: Int = 1
    var repeats: Int = 15
    var warmups: Int = 3
    var threadsPerGroup: Int = 256
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
        case "--k":
            if let v = takeValue(&i), let x = Int(v) { cfg.k = x }
        case "--m":
            if let v = takeValue(&i), let x = Int(v) { cfg.m = x }
        case "--repeats":
            if let v = takeValue(&i), let x = Int(v) { cfg.repeats = x }
        case "--warmups":
            if let v = takeValue(&i), let x = Int(v) { cfg.warmups = x }
        case "--tpg":
            if let v = takeValue(&i), let x = Int(v) { cfg.threadsPerGroup = x }
        case "--csv":
            if let v = takeValue(&i) { cfg.csvPath = v }
        default:
            break
        }
        i += 1
    }
    return cfg
}

func printUsage() {
    let txt = """
Usage:
  swift run simt-bench --mode sweep [--csv results.csv]
  swift run simt-bench --mode gpu-uniform --n 1048576 --k 2048 --repeats 15 --warmups 3 --tpg 256
  swift run simt-bench --mode gpu-divergent --n 1048576 --k 2048 --m 8 --repeats 15 --warmups 3 --tpg 256
  swift run simt-bench --mode cpu-uniform --n 1048576 --k 2048 --repeats 10 --warmups 2
  swift run simt-bench --mode cpu-divergent --n 1048576 --k 2048 --m 8 --repeats 10 --warmups 2
"""
    print(txt)
}
