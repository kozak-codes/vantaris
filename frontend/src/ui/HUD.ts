import { BIOME_CONFIGS } from '../constants';
import { clientState, onStateUpdate, notifySelectionChanged } from '../state/ClientState';
import { sendMoveUnit, sendSetUnitIdle, sendToggleCityProduction } from '../network/ColyseusClient';
import { PASSABLE_TERRAIN } from '@vantaris/shared/constants';
import { TerrainType } from '@vantaris/shared';
import { CITY_TROOP_PRODUCTION_TICKS } from '@vantaris/shared/constants';

const TIER_NAMES: Record<number, string> = {
  1: 'Settlement',
  2: 'Village',
  3: 'Town',
  4: 'City',
  5: 'Metropolis',
  6: 'Megacity',
};

export class HUD {
  private tooltip: HTMLElement;
  private legend: HTMLElement;
  private wordmark: HTMLElement;
  private tickCounter: HTMLElement;
  private tilePanel: HTMLElement;

  constructor() {
    this.tooltip = document.getElementById('hud-tooltip')!;
    this.legend = document.getElementById('hud-legend')!;
    this.wordmark = document.getElementById('hud-wordmark')!;
    this.tickCounter = document.getElementById('hud-tick')!;
    this.tilePanel = document.getElementById('hud-tile-panel')!;
    this.buildLegend();

    onStateUpdate(() => this.onStateUpdate());
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

  showTooltip(cellId: number, biome: string | null, fog: string, isPentagon: boolean): void {
    this.tooltip.classList.remove('hidden');
    const shape = isPentagon ? 'Pentagon' : 'Hexagon';
    const fogLabel = fog === 'VISIBLE' ? 'Visible' : fog === 'REVEALED' ? 'Revealed' : 'Unexplored';
    const biomeText = biome ? biome : '???';
    this.tooltip.innerHTML = `
      <div class="tooltip-id">Cell #${cellId}</div>
      <div class="tooltip-biome">${biomeText}</div>
      <div class="tooltip-shape">${shape}</div>
      <div class="tooltip-fog">${fogLabel}</div>
    `;
  }

  hideTooltip(): void {
    this.tooltip.classList.add('hidden');
  }

  private onStateUpdate(): void {
    this.updateTickCounter();
    this.updateTilePanel();
  }

  private updateTickCounter(): void {
    this.tickCounter.textContent = `Tick: ${clientState.currentTick}`;
  }

  private updateTilePanel(): void {
    const tileId = clientState.selectedTileId;
    if (!tileId) {
      this.tilePanel.classList.add('hidden');
      return;
    }

    const cellData = clientState.visibleCells.get(tileId);
    const revealedData = clientState.revealedCells.get(tileId);

    if (!cellData && !revealedData) {
      this.tilePanel.classList.add('hidden');
      return;
    }

    this.tilePanel.classList.remove('hidden');

    const biome = cellData ? cellData.biome : (revealedData ? revealedData.lastKnownBiome : '???');
    const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
    const isRevealed = !cellData && !!revealedData;

    const ownerPlayer = owner ? clientState.players.get(owner) : null;
    const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
    const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

    const unitsOnTile: { unitId: string; type: string; status: string; claimTicks: number; path: string[]; movementRemaining: number; movementTotal: number; isMyUnit: boolean }[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === tileId) {
        const isMyUnit = unit.ownerId === clientState.myPlayerId;
        unitsOnTile.push({
          unitId,
          type: unit.type,
          status: unit.status,
          claimTicks: unit.claimTicksRemaining,
          path: unit.path,
          movementRemaining: unit.movementTicksRemaining,
          movementTotal: unit.movementTicksTotal,
          isMyUnit,
        });
      }
    }

    let cityOnTile: { cityId: string; tier: number; producing: boolean; productionTicks: number; isMyCity: boolean } | null = null;
    for (const [cityId, city] of clientState.cities) {
      if (city.cellId === tileId) {
        cityOnTile = {
          cityId,
          tier: city.tier,
          producing: city.producingUnit,
          productionTicks: city.productionTicksRemaining,
          isMyCity: city.ownerId === clientState.myPlayerId,
        };
        break;
      }
    }

    const selectedUnit = clientState.selectedUnitId ? clientState.units.get(clientState.selectedUnitId) : null;
    const selectedCity = clientState.selectedCityId ? clientState.cities.get(clientState.selectedCityId) : null;

    let unitsHtml = '';
    if (unitsOnTile.length > 0) {
      unitsHtml = '<div class="panel-section"><div class="panel-subtitle">Units</div>';
      for (const u of unitsOnTile) {
        const isSelected = u.unitId === clientState.selectedUnitId;
        let statusIcon = '';
        if (u.status === 'MOVING') {
          const total = u.movementTotal || 10;
          const remaining = u.movementRemaining;
          const pct = ((total - remaining) / total) * 100;
          statusIcon = `<div class="progress-bar small"><div class="progress-fill" style="width: ${pct}%"></div></div>`;
        } else if (u.status === 'CLAIMING') {
          statusIcon = ` (${u.claimTicks} ticks)`;
        }
        unitsHtml += `<div class="panel-row unit-row ${isSelected ? 'selected-entity' : ''} ${u.isMyUnit ? 'my-unit' : ''}" data-unit-id="${u.unitId}">
          <span class="unit-icon" style="background: ${u.isMyUnit ? ownerColor : '#888'}"></span>
          <span>${u.type}${u.status !== 'IDLE' ? ' — ' + u.status : ''}</span>
          ${statusIcon}
        </div>`;
      }
      unitsHtml += '</div>';
    }

    let cityHtml = '';
    if (cityOnTile) {
      const isSelected = cityOnTile.cityId === clientState.selectedCityId;
      const prodProgress = cityOnTile.producing
        ? ((CITY_TROOP_PRODUCTION_TICKS - cityOnTile.productionTicks) / CITY_TROOP_PRODUCTION_TICKS) * 100
        : 0;
      const tierName = TIER_NAMES[cityOnTile.tier] || 'Settlement';
      cityHtml = `<div class="panel-section"><div class="panel-subtitle">Buildings</div>
        <div class="panel-row ${isSelected ? 'selected-entity' : ''}" data-city-id="${cityOnTile.cityId}">
          <span>${tierName}</span>
          ${cityOnTile.isMyCity ? '<span class="label owned-label">Yours</span>' : ''}
        </div>
        ${cityOnTile.producing ? `<div class="progress-bar small"><div class="progress-fill" style="width: ${prodProgress}%"></div></div>` : ''}
      </div>`;
    }

    let selectedInfo = '';
    if (selectedUnit) {
      const isMyUnit = selectedUnit.ownerId === clientState.myPlayerId;
      let actionHtml = '';
      if (isMyUnit && selectedUnit.status === 'IDLE') {
        actionHtml = '<div class="panel-actions"><button class="panel-btn" id="unit-idle-btn">Stop</button></div>';
      }
      selectedInfo = `<div class="panel-section selected-info">
        <div class="panel-subtitle">Selected Unit</div>
        <div class="panel-row"><span class="label">Type</span><span>${selectedUnit.type}</span></div>
        <div class="panel-row"><span class="label">Status</span><span>${selectedUnit.status}</span></div>
        ${actionHtml}
      </div>`;
    } else if (selectedCity) {
      const isMyCity = selectedCity.ownerId === clientState.myPlayerId;
      let actionHtml = '';
      if (isMyCity) {
        const btnLabel = selectedCity.producingUnit ? 'Pause Production' : 'Start Production';
        actionHtml = `<div class="panel-actions"><button class="panel-btn" id="city-production-btn">${btnLabel}</button></div>`;
      }
      selectedInfo = `<div class="panel-section selected-info">
        <div class="panel-subtitle">Selected Building</div>
        <div class="panel-row"><span class="label">Tier</span><span>${TIER_NAMES[selectedCity.tier] || 'Settlement'}</span></div>
        ${actionHtml}
      </div>`;
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">${isRevealed ? '⚠ Revealed' : biome}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style="${owner ? 'color:' + ownerColor : ''}">${ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${biome}</span></div>
        <div class="panel-row"><span class="label">Units</span><span>${unitsOnTile.length}</span></div>
      </div>
      ${cityHtml}
      ${unitsHtml}
      ${selectedInfo}
    `;

    document.getElementById('tile-deselect')?.addEventListener('click', () => {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      notifySelectionChanged();
    });

    document.querySelectorAll('[data-unit-id]').forEach(el => {
      el.addEventListener('click', () => {
        const uid = (el as HTMLElement).dataset.unitId!;
        clientState.selectedUnitId = uid;
        clientState.selectedCityId = null;
        notifySelectionChanged();
      });
    });

    document.querySelectorAll('[data-city-id]').forEach(el => {
      el.addEventListener('click', () => {
        const cid = (el as HTMLElement).dataset.cityId!;
        clientState.selectedCityId = cid;
        clientState.selectedUnitId = null;
        notifySelectionChanged();
      });
    });

    const idleBtn = document.getElementById('unit-idle-btn');
    if (idleBtn && selectedUnit) {
      idleBtn.addEventListener('click', () => {
        sendSetUnitIdle(selectedUnit.unitId);
      });
    }

    const prodBtn = document.getElementById('city-production-btn');
    if (prodBtn && selectedCity) {
      prodBtn.addEventListener('click', () => {
        sendToggleCityProduction(selectedCity.cityId, !selectedCity.producingUnit);
      });
    }
  }
}