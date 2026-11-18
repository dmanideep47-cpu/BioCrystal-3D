import matplotlib.pyplot as plt
import numpy as np
import os

os.makedirs('report/assets', exist_ok=True)

# Generate stylized high-tech B-DNA double helix banner
fig, ax = plt.subplots(figsize=(8.5, 3.2), dpi=300)
fig.patch.set_facecolor('#0F172A') # Deep slate navy
ax.set_facecolor('#0F172A')

t = np.linspace(0, 4 * np.pi, 250)
x = np.linspace(0, 10, 250)
y1 = np.sin(t) * 0.8
y2 = -np.sin(t) * 0.8
z1 = np.cos(t)

# Base pairs (rungs)
for i in range(0, 250, 8):
    alpha = (np.cos(t[i]) + 1.2) / 2.4
    color = '#0F766E' if i % 16 == 0 else '#14B8A6'
    if i % 32 == 16:
        color = '#F59E0B' # Highlighted mutation base pair
    ax.plot([x[i], x[i]], [y1[i], y2[i]], color=color, alpha=0.5 + 0.4*alpha, lw=1.8, zorder=1)
    ax.scatter([x[i], x[i]], [y1[i], y2[i]], color=['#2DD4BF', '#38BDF8'], s=25*alpha, zorder=2)

# Strands
ax.plot(x, y1, color='#0D9488', lw=3.2, zorder=3, alpha=0.95)
ax.plot(x, y2, color='#0284C7', lw=3.2, zorder=3, alpha=0.95)

# Subtle overlay text or molecular grid
ax.set_xlim(-0.2, 10.2)
ax.set_ylim(-1.5, 1.5)
ax.axis('off')

# Title annotation
ax.text(5.0, -1.2, "B I O C R Y S T A L   3 D   |   M A C R O M O L E C U L A R   B I O I N F O R M A T I C S",
        color='#94A3B8', fontsize=8.0, fontweight='bold', fontfamily='sans-serif',
        ha='center', va='center')

fig.tight_layout(pad=0)
fig.savefig('report/assets/cover_banner.png', facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
plt.close(fig)
print('Cover banner successfully generated at report/assets/cover_banner.png')
