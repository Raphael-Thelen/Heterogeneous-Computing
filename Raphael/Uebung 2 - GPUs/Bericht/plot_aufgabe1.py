#!/usr/bin/env python3
"""
Visualisierung der SIMT und Warp-Divergenz Messergebnisse für Aufgabe 1.
Zeigt GPU-Skalierung und Performance-Einbruch durch Divergenz.
"""

import pandas as pd
import matplotlib.pyplot as plt
import os

# Pfade zu den Datendateien
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PARENT_DIR, "Aufgabe 1 - SIMT und Warp-Divergenz")

results_file = os.path.join(DATA_DIR, "test-results.csv")

# Daten einlesen
print("Lade Testergebnisse...")
df = pd.read_csv(results_file)

print(f"Geladen: {len(df)} Messungen")
print(f"Modi: {df['mode'].unique()}")

# ============================================================================
# Plot 1: GPU Uniform Skalierung über n
# ============================================================================
print("\nErstelle Plot 1: GPU Uniform Skalierung...")

df_uniform = df[df['mode'] == 'gpu_uniform'].copy()
df_uniform = df_uniform.sort_values('n')

fig1, ax1 = plt.subplots(figsize=(11, 6))

# Plot mit Marker für bessere Sichtbarkeit
ax1.plot(df_uniform['n'], df_uniform['gflops'], 
         marker='o', linewidth=2.5, markersize=7, 
         color='#79daa1', alpha=0.8, label='GPU Performance')

# Fyll-Area für bessere Visualisierung
ax1.fill_between(df_uniform['n'], df_uniform['gflops'], alpha=0.2, color='#79daa1')

ax1.set_xlabel('Problemgröße n (Anzahl Elemente)', fontsize=11, fontweight='bold')
ax1.set_ylabel('Rechenleistung (GFLOP/s)', fontsize=11, fontweight='bold')
ax1.set_title('GPU-Skalierung über Problemgröße (Uniform Pattern)\nk=2048, tpg=128', 
              fontsize=12, fontweight='bold')

# Log-Skala für x-Achse für bessere Sichtbarkeit
ax1.set_xscale('log', base=2)
ax1.grid(alpha=0.3, linestyle=':')
ax1.legend(fontsize=10, loc='best')

plt.tight_layout()
output_file1 = os.path.join(BASE_DIR, "01_gpu_skalierung_uniform.png")
fig1.savefig(output_file1, dpi=300, bbox_inches='tight')
print(f"✓ Plot 1 gespeichert: {output_file1}")
plt.close(fig1)

# ============================================================================
# Plot 2: GPU Divergent - Performance-Einbruch durch Divergenz
# ============================================================================
print("Erstelle Plot 2: Divergenz-Performance-Einbruch...")

df_divergent = df[df['mode'] == 'gpu_divergent'].copy()

# Finde den m=1 Baseline-Wert
m1_gflops = df_divergent[df_divergent['m'] == 1]['gflops'].values[0]

# Berechne relative Performance
df_divergent['gflops_relative'] = df_divergent['gflops'] / m1_gflops * 100
df_divergent = df_divergent.sort_values('m')

fig2, ax2 = plt.subplots(figsize=(10, 6))

# Bar-Chart für Divergenz-Effekt
bars = ax2.bar(df_divergent['m'].astype(str), df_divergent['gflops_relative'], 
               color="#79daa1", alpha=0.7)

# Referenzlinie bei 100% (Baseline m=1)
ax2.axhline(100, color='green', linestyle='--', linewidth=2, label='Baseline (m=1)', alpha=0.7)

# Werte auf Balken anzeigen
for bar, val, gflops in zip(bars, df_divergent['gflops_relative'], df_divergent['gflops']):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height + 1,
             f'{val:.1f}%\n({gflops:.1f} GFLOP/s)',
             ha='center', va='bottom', fontsize=9, fontweight='bold')

ax2.set_xlabel('Divergenzgrad (m)', fontsize=11, fontweight='bold')
ax2.set_ylabel('Relative Performance (% der Baseline)', fontsize=11, fontweight='bold')
ax2.set_title('Performance-Einbruch durch Branch Divergence\n(n=4194304, k=2048, tpg=128)', 
              fontsize=12, fontweight='bold')
ax2.set_ylim(0, 120)
ax2.legend(fontsize=10)
ax2.grid(axis='y', alpha=0.3, linestyle=':')

plt.tight_layout()
output_file2 = os.path.join(BASE_DIR, "01_divergenz_performance_verlust.png")
fig2.savefig(output_file2, dpi=300, bbox_inches='tight')
print(f"✓ Plot 2 gespeichert: {output_file2}")
plt.close(fig2)

# ============================================================================
# Plot 3: CPU Divergent - Vergleich mit GPU
# ============================================================================
print("Erstelle Plot 3: CPU vs GPU Divergenz-Vergleich...")

df_gpu_div = df[df['mode'] == 'gpu_divergent'].copy().sort_values('m')
df_cpu_div = df[df['mode'] == 'cpu-divergent'].copy().sort_values('m')

fig3, ax3 = plt.subplots(figsize=(11, 6))

# Normalisiere auf m=1 Baseline für beide
gpu_m1 = df_gpu_div[df_gpu_div['m'] == 1]['gflops'].values[0]
cpu_m1 = df_cpu_div[df_cpu_div['m'] == 1]['gflops'].values[0]

df_gpu_div['rel_perf'] = df_gpu_div['gflops'] / gpu_m1 * 100
df_cpu_div['rel_perf'] = df_cpu_div['gflops'] / cpu_m1 * 100

# Plot mit zwei Kurven
ax3.plot(df_gpu_div['m'], df_gpu_div['rel_perf'], 
         marker='s', linewidth=3, markersize=10, 
         label='GPU (Metal)', color='#79daa1', alpha=0.8)
ax3.plot(df_cpu_div['m'], df_cpu_div['rel_perf'], 
         marker='o', linewidth=3, markersize=10, 
         label='CPU', color='#7ab5db', alpha=0.8)

ax3.axhline(100, color='red', linestyle='--', linewidth=2, label='Baseline (m=1)', alpha=0.5)

ax3.set_xlabel('Divergenzgrad (m)', fontsize=11, fontweight='bold')
ax3.set_ylabel('Relative Performance (% der Baseline)', fontsize=11, fontweight='bold')
ax3.set_title('GPU vs. CPU: Impact of Branch Divergence\n(GPU: n=4194304, CPU: n=262144)', 
              fontsize=12, fontweight='bold')
ax3.set_xscale('log', base=2)
ax3.set_ylim(0, 120)
ax3.legend(fontsize=11, loc='best')
ax3.grid(alpha=0.3, linestyle=':')

plt.tight_layout()
output_file3 = os.path.join(BASE_DIR, "01_gpu_vs_cpu_divergenz.png")
fig3.savefig(output_file3, dpi=300, bbox_inches='tight')
print(f"✓ Plot 3 gespeichert: {output_file3}")
plt.close(fig3)

# ============================================================================
# Plot 4: CPU Uniform vs n (wenn Daten vorhanden)
# ============================================================================
df_cpu_uniform = df[df['mode'] == 'cpu-uniform'].copy()
if len(df_cpu_uniform) > 0:
    print("Erstelle Plot 4: CPU Uniform Skalierung...")
    
    df_cpu_uniform = df_cpu_uniform.sort_values('n')
    
    fig4, ax4 = plt.subplots(figsize=(11, 6))
    
    ax4.plot(df_cpu_uniform['n'], df_cpu_uniform['gflops'], 
             marker='o', linewidth=2.5, markersize=7, 
             color="#7ab5db", alpha=0.8, label='CPU Performance')
    
    ax4.fill_between(df_cpu_uniform['n'], df_cpu_uniform['gflops'], alpha=0.2, color='#7ab5db')
    
    ax4.set_xlabel('Problemgröße n (Anzahl Elemente)', fontsize=11, fontweight='bold')
    ax4.set_ylabel('Rechenleistung (GFLOP/s)', fontsize=11, fontweight='bold')
    ax4.set_title('CPU-Performance über Problemgröße (Uniform Pattern)\nk=2048', 
                  fontsize=12, fontweight='bold')
    
    ax4.set_xscale('log', base=2)
    ax4.grid(alpha=0.3, linestyle=':')
    ax4.legend(fontsize=10, loc='best')
    
    plt.tight_layout()
    output_file4 = os.path.join(BASE_DIR, "01_cpu_skalierung_uniform.png")
    fig4.savefig(output_file4, dpi=300, bbox_inches='tight')
    print(f"✓ Plot 4 gespeichert: {output_file4}")
    plt.close(fig4)

# ============================================================================
# Plot 5: TPG Kalibrierung
# ============================================================================
print("\nErstelle Plot 5: TPG Kalibrierung...")

calib_file = os.path.join(DATA_DIR, "tpg-calibration.csv")
df_calib = pd.read_csv(calib_file)

df_calib = df_calib.sort_values('tpg')

fig5, ax5 = plt.subplots(figsize=(10, 6))

tpg_values = df_calib['tpg'].values
gflops_values = df_calib['gflops'].values

bars = ax5.bar([str(tpg) for tpg in tpg_values], gflops_values, 
              color="#79daa1", alpha=0.7)

# Werte auf Balken anzeigen
for bar, val, tpg in zip(bars, gflops_values, tpg_values):
    height = bar.get_height()
    ax5.text(bar.get_x() + bar.get_width()/2., height + 5,
            f'{val:.1f} GFLOP/s',
            ha='center', va='bottom', fontsize=10, fontweight='bold')
    
ax5.set_xlabel('Threadgroup Size (tpg)', fontsize=11, fontweight='bold')
ax5.set_ylabel('Rechenleistung (GFLOP/s)', fontsize=11, fontweight='bold')
ax5.set_title('TPG Kalibrierung: Optimale Threadgroup-Größe\n(n=4194304, k=2048)', 
             fontsize=12, fontweight='bold')
ax5.set_ylim(680, 720)
ax5.grid(axis='y', alpha=0.3, linestyle=':')

plt.tight_layout()
output_file5 = os.path.join(BASE_DIR, "01_tpg_kalibrierung.png")
fig5.savefig(output_file5, dpi=300, bbox_inches='tight')
print(f"✓ Plot 5 gespeichert: {output_file5}")
plt.close(fig5)