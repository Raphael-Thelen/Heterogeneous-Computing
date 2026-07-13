#!/usr/bin/env python3
"""
Visualisierung der GPU-Bandbreiteen-Messergebnisse für Aufgabe 2.
Zeigt Einfluss des Zugriffsmusters und der Latenzversteckung durch Parallelität.
"""

import pandas as pd
import matplotlib.pyplot as plt
import os

# Pfade zu den Datendateien
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PARENT_DIR, "Aufgabe 2 - Latenz verstecken und Bandbreite")

file2 = os.path.join(DATA_DIR, "test-row-2.csv")

# Daten einlesen
print("Lade Testergebnisse...")
df2 = pd.read_csv(file2)

# Peak-Bandbreite
peak_gbps = 68.25

print(f"Datensatz: {len(df2)} Messungen (n={df2['n'].iloc[0]})")
print(f"Peak-Bandbreite M1: {peak_gbps} GB/s")

# ============================================================================
# Plot 1: Bandbreite für die drei Muster bei fester TPG
# ============================================================================
# Wähle bestes TPG: 64 (gutes Occupancy/Performance Trade-off)
best_tpg = 64
df_fixed_tpg = df2[df2['tpg'] == best_tpg].copy()

patterns = df_fixed_tpg['pattern'].unique()
gbps_values = [df_fixed_tpg[df_fixed_tpg['pattern'] == p]['gbps'].values[0] 
               for p in ['coalesced', 'stride', 'gather']]

fig1, ax1 = plt.subplots(figsize=(10, 6))

colors = ['#2ecc71', '#e74c3c', '#3498db']
bars = ax1.bar(['Coalesced\n(Sequential)', 'Stride (k=16)\n(Strided)', 'Gather\n(Random)'], 
               gbps_values, color=colors, alpha=0.7)

# Referenzlinie für Peak-Bandbreite
ax1.axhline(peak_gbps, color='red', linestyle='--', linewidth=2, label=f'Theoretische Max. Bandbreite ({peak_gbps} GB/s)')

# Werte auf Balken anzeigen
for i, (bar, val) in enumerate(zip(bars, gbps_values)):
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height + 1,
             f'{val:.1f} GB/s\n({val/peak_gbps*100:.1f}%)',
             ha='center', va='bottom', fontsize=10, fontweight='bold')

ax1.set_ylabel('Effektive Bandbreite (GB/s)', fontsize=11, fontweight='bold')
ax1.set_xlabel('Zugriffsmuster', fontsize=11, fontweight='bold')
ax1.set_title(f'Einfluss des Zugriffsmusters auf Bandbreite\n(TPG={best_tpg}, Datensatz: n=16.7M)', 
              fontsize=12, fontweight='bold')
ax1_max = max(max(gbps_values), peak_gbps)
ax1.set_ylim(0, ax1_max * 1.15)
ax1.legend(fontsize=10)
ax1.grid(axis='y', alpha=0.3, linestyle=':')

plt.tight_layout()
output_file1 = os.path.join(BASE_DIR, "02_zugriffsmuster_vergleich.png")
fig1.savefig(output_file1, dpi=300, bbox_inches='tight')
print(f"✓ Plot 1 gespeichert: {output_file1}")
plt.close(fig1)

# ============================================================================
# Plot 2: Bandbreite vs. TPG pro Muster (Latenzversteckung)
# ============================================================================
fig2, ax2 = plt.subplots(figsize=(10, 6))

for pattern, color in zip(['coalesced', 'stride', 'gather'], colors):
    df_pattern = df2[df2['pattern'] == pattern].sort_values('tpg')
    ax2.plot(df_pattern['tpg'], df_pattern['gbps'], marker='o', linewidth=2.5, 
             markersize=8, label=pattern.capitalize(), color=color, alpha=0.8)

ax2.axhline(peak_gbps, color='red', linestyle='--', linewidth=2, label=f'Theo. Max. ({peak_gbps} GB/s)')

ax2.set_xlabel('Threads per Group (TPG)', fontsize=11, fontweight='bold')
ax2.set_ylabel('Effektive Bandbreite (GB/s)', fontsize=11, fontweight='bold')
ax2.set_title('Latenzversteckung durch Parallelität\n(Datensatz: n=16.7M, Stride k=16)', 
              fontsize=12, fontweight='bold')
ax2.set_xscale('log', base=2)
ax2_max = max(df2['gbps'].max(), peak_gbps)
ax2.set_ylim(0, ax2_max * 1.15)
ax2.legend(fontsize=10, loc='best')
ax2.grid(alpha=0.3, linestyle=':')

plt.tight_layout()
output_file2 = os.path.join(BASE_DIR, "02_latenzversteckung_tpg.png")
fig2.savefig(output_file2, dpi=300, bbox_inches='tight')
print(f"✓ Plot 2 gespeichert: {output_file2}")
plt.close(fig2)

# ============================================================================
# Zusätzliche Statistiken
# ============================================================================
print("\n" + "="*70)
print("STATISTISCHE ZUSAMMENFASSUNG")
print("="*70)

for pattern in ['coalesced', 'stride', 'gather']:
    subset = df2[df2['pattern'] == pattern]
    mean_gbps = subset['gbps'].mean()
    min_gbps = subset['gbps'].min()
    max_gbps = subset['gbps'].max()
    
    print(f"\n{pattern.upper()}")
    print(f"  Durchschnitt: {mean_gbps:.2f} GB/s")
    print(f"  Min: {min_gbps:.2f} GB/s, Max: {max_gbps:.2f} GB/s")
    print(f"  % of Peak: {mean_gbps/peak_gbps*100:.1f}%")

print("\n" + "="*70)
print("VERHÄLTNISSE BEI TPG=64")
print("="*70)

subset_tpg64 = df2[df2['tpg'] == 64]
coal_gbps = subset_tpg64[subset_tpg64['pattern'] == 'coalesced']['gbps'].values[0]
stride_gbps = subset_tpg64[subset_tpg64['pattern'] == 'stride']['gbps'].values[0]
gather_gbps = subset_tpg64[subset_tpg64['pattern'] == 'gather']['gbps'].values[0]

print(f"Coalesced: {coal_gbps:.2f} GB/s (100%)")
print(f"Stride:    {stride_gbps:.2f} GB/s ({stride_gbps/coal_gbps*100:.1f}% of coalesced)")
print(f"Gather:    {gather_gbps:.2f} GB/s ({gather_gbps/coal_gbps*100:.1f}% of coalesced)")

print("\n" + "="*70)
