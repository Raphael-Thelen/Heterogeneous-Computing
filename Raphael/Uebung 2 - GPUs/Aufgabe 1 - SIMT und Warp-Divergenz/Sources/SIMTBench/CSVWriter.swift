import Foundation

func appendCSV(path: String, line: String) throws {
    let url = URL(fileURLWithPath: path)
    if !FileManager.default.fileExists(atPath: path) {
        let header = "mode,n,k,m,tpg,mean_ms,std_ms,gflops\n"
        try header.write(to: url, atomically: true, encoding: .utf8)
    }

    if let fh = try? FileHandle(forWritingTo: url) {
        defer { try? fh.close() }
        try fh.seekToEnd()
        if let data = (line + "\n").data(using: .utf8) {
            try fh.write(contentsOf: data)
        }
    } else {
        try (line + "\n").write(to: url, atomically: true, encoding: .utf8)
    }
}
