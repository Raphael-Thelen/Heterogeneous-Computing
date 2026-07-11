# Aufgabe 1 - SIMT und Warp-Divergenz (M1/Metal)

Dieses Projekt implementiert den Benchmark für Aufgabe 1 mit Swift + Metal:

- GPU uniform (keine Divergenz)
- GPU divergent (kontrollierbarer Divergenzgrad m bei konstanter Arbeit pro Thread)
- CPU-Referenz (uniform/divergent)

Der Kernel verwendet ein synthetisches ALU-Mischen über `k` Iterationen:

- pro Thread 1 Load, dann `k` arithmetische Iterationen, dann 1 Store
- pro Iteration zwei FMA-basierte Update-Schritte
- in `gpu_divergent` bleibt `k` konstant; nur der Instruktionspfad variiert mit `m`

## Voraussetzungen

- macOS auf Apple Silicon (M1/M2/...) 
- Xcode Command Line Tools (`xcode-select --install`)
- Swift 5.9+

## Build

```bash
swift build
```

## Schnelle Testläufe
```bash
# GPU ohne Divergenz
swift run simt-bench --mode gpu-uniform --n 1048576 --k 2048 --repeats 10 --warmups 3 --tpg 256 --csv results.csv

# GPU mit Divergenzgrad m=8
swift run simt-bench --mode gpu-divergent --n 1048576 --k 2048 --m 8 --repeats 10 --warmups 3 --tpg 256 --csv results.csv

# CPU Referenz
swift run simt-bench --mode cpu-uniform --n 1048576 --k 2048 --repeats 8 --warmups 2 --csv results.csv
swift run simt-bench --mode cpu-divergent --n 1048576 --k 2048 --m 8 --repeats 8 --warmups 2 --csv results.csv
```

## Voller Sweep

```bash
swift run simt-bench --mode sweep --k 2048 --repeats 15 --warmups 3 --tpg 256 --csv results.csv
```

Der Sweep erzeugt:

- Skalierung über `n` für `gpu_uniform`
- Divergenz-Sweep über `m in {1,2,4,8,16,32}` für `gpu_divergent`

Interpretation von `m`:

- `m = 1`: keine Divergenz
- größeres `m`: mehr unterschiedliche Pfade innerhalb einer Threadgroup/SIMD-Group
- die Arbeitsmenge pro Thread bleibt gleich; der Performance-Einbruch kommt damit sauber aus der Divergenz

## CSV-Format

`mode,n,k,m,tpg,mean_ms,std_ms,gflops`
