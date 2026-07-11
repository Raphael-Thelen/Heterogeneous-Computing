# Aufgabe 2 - Latenz verstecken und Bandbreite (M1/Metal)

Dieses Projekt misst speicherintensive GPU-Kernel mit geringer arithmetischer Intensitaet.

## Zugriffsmuster

- `coalesced`: zusammenhaengender Zugriff (`stride 1`)
- `stride`: gestriped Zugriff (`idx = (i * stride) % n`)
- `gather`: zufaelliger Zugriff ueber Indexfeld

## Gemessene Metriken

- `mean_ms`, `std_ms`
- effektive Bandbreite `gbps`
- `ratio_input_peak` (falls `--peak-gbps` gesetzt)
- `ratio_empirical_peak` (normiert auf bestes coalesced Ergebnis)
- `occ_proxy` als Occupancy-Proxy:
  - `active_simdgroups / max_simdgroups_per_threadgroup`
  - aus `threadExecutionWidth` und `maxTotalThreadsPerThreadgroup`

Hinweis: Apple Metal bietet keine direkte Warp-Occupancy wie CUDA. `occ_proxy` ist deshalb ein reproduzierbarer, theoretischer Naeherungswert auf Threadgroup-Ebene.

## Build

```bash
swift build
```

## Einzelmodus

```bash
swift run memory-bench --mode coalesced --n 16777216 --tpg-list 128 --repeats 10 --warmups 3 --csv results.csv
swift run memory-bench --mode stride --n 16777216 --stride 16 --tpg-list 128 --repeats 10 --warmups 3 --csv results.csv
swift run memory-bench --mode gather --n 16777216 --tpg-list 128 --repeats 10 --warmups 3 --csv results.csv
```

## Finaler Sweep

```bash
swift run memory-bench --mode sweep --n 16777216 --stride 16 --tpg-list 32,64,128,256,512 --repeats 10 --warmups 3 --peak-gbps 68.25 --csv results.csv
```

## CSV-Format

`pattern,n,stride,tpg,tew,max_tpg,occ_proxy,mean_ms,std_ms,gbps,ratio_input_peak,ratio_empirical_peak`
