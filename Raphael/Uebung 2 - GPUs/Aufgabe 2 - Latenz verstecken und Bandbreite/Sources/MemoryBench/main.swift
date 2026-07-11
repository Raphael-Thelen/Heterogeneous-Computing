import Foundation

do {
    try runApp()
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    exit(1)
}
