import { BiomeType } from '../types/index';
import { BIOME_CONFIGS } from '../constants';

export class HUD {
  private tooltip: HTMLElement;
  private legend: HTMLElement;
  private wordmark: HTMLElement;

  constructor() {
    this.tooltip = document.getElementById('hud-tooltip')!;
    this.legend = document.getElementById('hud-legend')!;
    this.wordmark = document.getElementById('hud-wordmark')!;
    this.buildLegend();
  }

  private buildLegend(): void {
    const title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Biomes';
    this.legend.appendChild(title);

    for (const config of BIOME_CONFIGS) {
      const row = document.createElement('div');
      row.className = 'legend-row';
      const swatch = document.createElement('div');
      swatch.className = 'legend-swatch';
      swatch.style.backgroundColor = config.color;
      const label = document.createElement('span');
      label.textContent = config.type;
      row.appendChild(swatch);
      row.appendChild(label);
      this.legend.appendChild(row);
    }
  }

  showTooltip(cellId: number, biome: string, fog: string, isPentagon: boolean): void {
    this.tooltip.classList.remove('hidden');
    const shape = isPentagon ? 'Pentagon' : 'Hexagon';
    const fogLabel = fog === 'Visible' ? '👁 Visible' : fog === 'Explored' ? '🌫 Explored' : '⬛ Unexplored';
    this.tooltip.innerHTML = `
      <div class="tooltip-id">Cell #${cellId}</div>
      <div class="tooltip-biome">${biome}</div>
      <div class="tooltip-shape">${shape}</div>
      <div class="tooltip-fog">${fogLabel}</div>
    `;
  }

  hideTooltip(): void {
    this.tooltip.classList.add('hidden');
  }
}