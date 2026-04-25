import { BIOME_CONFIGS } from '../constants';
import { clientState, onStateUpdate, notifySelectionChanged, getUnitActions, getCityActions } from '../state/ClientState';
import { sendMoveUnit, sendSetUnitIdle, sendToggleCityProduction, sendClaimTerritory } from '../network/ColyseusClient';
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

const BIOME_TRAVEL_NAMES: Record<string, string> = {
  PLAINS: 'Plains',
  FOREST: 'Forest',
  MOUNTAIN: 'Mountain',
  DESERT: 'Desert',
  TUNDRA: 'Tundra',
  OCEAN: 'Ocean',
};

const STATUS_DISPLAY: Record<string, string> = {
  IDLE: 'Idle',
  MOVING: 'Moving',
  CLAIMING: 'Claiming',
};

export class HUD {
  private tooltip: HTMLElement;
  private legend: HTMLElement;
  private wordmark: HTMLElement;
  private tickCounter: HTMLElement;
  private tilePanel: HTMLElement;
  private suppressUpdate: boolean = false;

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
    if (!this.suppressUpdate) {
      this.updateTilePanel();
    }
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

    const selectedUnit = clientState.selectedUnitId ? clientState.units.get(clientState.selectedUnitId) : null;
    const selectedCity = clientState.selectedCityId ? clientState.cities.get(clientState.selectedCityId) : null;

    if (selectedUnit) {
      this.renderUnitPanel(selectedUnit, tileId, biome, ownerName, ownerColor, isRevealed);
    } else if (selectedCity) {
      this.renderCityPanel(selectedCity, tileId, biome, ownerName, ownerColor, isRevealed);
    } else {
      this.renderTilePanel(tileId, biome, ownerName, ownerColor, isRevealed);
    }
  }

  private renderUnitPanel(unit: { unitId: string; ownerId: string; type: string; status: string; cellId: string; path: string[]; movementTicksRemaining: number; movementTicksTotal: number; claimTicksRemaining: number }, tileId: string, biome: string, ownerName: string, ownerColor: string, isRevealed: boolean): void {
    const isMyUnit = unit.ownerId === clientState.myPlayerId;
    const player = clientState.players.get(unit.ownerId);
    const unitColor = player ? player.color : '#888';
    const pendingCommand = clientState.pendingCommand;

    let statusText = STATUS_DISPLAY[unit.status] || unit.status;
    let progressHtml = '';

    if (unit.status === 'MOVING') {
      const total = unit.movementTicksTotal || 10;
      const remaining = unit.movementTicksRemaining;
      const pct = Math.round(((total - remaining) / total) * 100);
      progressHtml = `<div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>`;
      if (unit.path && unit.path.length > 0) {
        statusText += ` — ${unit.path.length} tiles to go`;
      }
    } else if (unit.status === 'CLAIMING') {
      const maxTicks = unit.claimTicksRemaining > 100 ? 300 : 50;
      const pct = Math.round(((maxTicks - unit.claimTicksRemaining) / maxTicks) * 100);
      progressHtml = `<div class="progress-bar"><div class="progress-fill claim-fill" style="width: ${pct}%"></div></div>
        <div class="panel-row"><span class="label">Claiming</span><span>${unit.claimTicksRemaining} ticks</span></div>`;
    }

    let commandsHtml = '';
    if (isMyUnit && unit.status === 'IDLE') {
      const cellData = clientState.visibleCells.get(unit.cellId);
      const alreadyOwnsTile = cellData && cellData.ownerId === clientState.myPlayerId;
      const moveActive = pendingCommand === 'move' ? ' active' : '';
      const claimButton = alreadyOwnsTile ? '' : `<button class="panel-btn cmd-btn" id="cmd-claim" title="Claim the tile this unit is standing on">2 Claim<span class="cmd-key">2</span></button>`;
      commandsHtml = `<div class="panel-actions">
        <button class="panel-btn cmd-btn${moveActive}" id="cmd-move" title="Click a destination tile to move there">1 Move<span class="cmd-key">1</span></button>
        ${claimButton}
        <button class="panel-btn" id="cmd-stop" title="Stop unit / cancel">Stop</button>
      </div>`;
      if (pendingCommand === 'move') {
        commandsHtml += `<div class="cmd-hint">Click a tile to move there</div>`;
      }
    } else if (isMyUnit && unit.status !== 'IDLE') {
      commandsHtml = `<div class="panel-actions">
        <button class="panel-btn" id="cmd-stop">Halt</button>
      </div>`;
    }

    const unitsOnTile: string[] = [];
    for (const [uid, u] of clientState.units) {
      if (u.cellId === tileId) unitsOnTile.push(uid);
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title" style="color: ${unitColor}">⦿ ${unit.type}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Status</span><span>${statusText}</span></div>
        <div class="panel-row"><span class="label">Owner</span><span style="color: ${ownerColor}">${ownerName}${isMyUnit ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        ${unitsOnTile.length > 1 ? `<div class="panel-row"><span class="label">Stack</span><span>${unitsOnTile.length} units</span></div>` : ''}
      </div>
      ${progressHtml}
      ${commandsHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" id="back-to-tile">← Tile info</button>
      </div>
    `;

    this.bindPanelEvents(unit);
  }

  private renderCityPanel(city: { cityId: string; ownerId: string; cellId: string; tier: number; xp: number; population: number; producingUnit: boolean; productionTicksRemaining: number }, tileId: string, biome: string, ownerName: string, ownerColor: string, isRevealed: boolean): void {
    const isMyCity = city.ownerId === clientState.myPlayerId;
    const tierName = TIER_NAMES[city.tier] || 'Settlement';
    const player = clientState.players.get(city.ownerId);
    const cityColor = player ? player.color : '#888';

    const maxUnits = city.tier + 1;
    const unitsHere = this.countUnitsOnTile(tileId);

    let productionHtml = '';
    if (city.producingUnit) {
      const pct = Math.round(((CITY_TROOP_PRODUCTION_TICKS - city.productionTicksRemaining) / CITY_TROOP_PRODUCTION_TICKS) * 100);
      productionHtml = `<div class="panel-section">
        <div class="panel-subtitle">Production</div>
        <div class="panel-row"><span class="label">Building</span><span>Infantry</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
        <div class="panel-row"><span class="label">Ready in</span><span>${city.productionTicksRemaining} ticks</span></div>
      </div>`;
    }

    let actionsHtml = '';
    if (isMyCity) {
      const btnLabel = city.producingUnit ? '⏸ Pause' : '▸ Queue Infantry';
      actionsHtml = `<div class="panel-actions">
        <button class="panel-btn" id="city-production-btn">${btnLabel}</button>
      </div>`;
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title" style="color: ${cityColor}">⌂ ${tierName}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style="color: ${ownerColor}">${ownerName}${isMyCity ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Tier</span><span>${tierName} (Lv.${city.tier})</span></div>
        <div class="panel-row"><span class="label">Population</span><span>${city.population}</span></div>
        <div class="panel-row"><span class="label">Garrison</span><span>${unitsHere} / ${maxUnits}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
      </div>
      ${productionHtml}
      ${actionsHtml}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" id="back-to-tile">← Tile info</button>
      </div>
    `;

    document.getElementById('tile-deselect')?.addEventListener('click', () => {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
    });

    document.getElementById('back-to-tile')?.addEventListener('click', () => {
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
    });

    const prodBtn = document.getElementById('city-production-btn');
    if (prodBtn) {
      prodBtn.addEventListener('click', () => {
        sendToggleCityProduction(city.cityId, !city.producingUnit);
      });
    }
  }

  private renderTilePanel(tileId: string, biome: string, ownerName: string, ownerColor: string, isRevealed: boolean): void {
    const unitsOnTile: { unitId: string; type: string; status: string; isMyUnit: boolean; color: string }[] = [];
    for (const [unitId, unit] of clientState.units) {
      if (unit.cellId === tileId) {
        const isMyUnit = unit.ownerId === clientState.myPlayerId;
        const player = clientState.players.get(unit.ownerId);
        const color = player ? player.color : '#888';
        unitsOnTile.push({ unitId, type: unit.type, status: unit.status, isMyUnit, color });
      }
    }

    let cityOnTile: { cityId: string; tier: number; producing: boolean; isMyCity: boolean } | null = null;
    for (const [cityId, city] of clientState.cities) {
      if (city.cellId === tileId) {
        cityOnTile = { cityId, tier: city.tier, producing: city.producingUnit, isMyCity: city.ownerId === clientState.myPlayerId };
        break;
      }
    }

    let unitsHtml = '';
    if (unitsOnTile.length > 0) {
      unitsHtml = '<div class="panel-section"><div class="panel-subtitle">Units</div>';
      for (const u of unitsOnTile) {
        const statusText = u.status !== 'IDLE' ? ` — ${STATUS_DISPLAY[u.status] || u.status}` : '';
        unitsHtml += `<div class="panel-row unit-row my-unit" data-unit-id="${u.unitId}">
          <span class="unit-icon" style="background: ${u.color}"></span>
          <span>${u.type}${statusText}</span>
          ${u.isMyUnit ? '<span class="label owned-label">Yours</span>' : ''}
        </div>`;
      }
      unitsHtml += '</div>';
    }

    let cityHtml = '';
    if (cityOnTile) {
      const tierName = TIER_NAMES[cityOnTile.tier] || 'Settlement';
      cityHtml = `<div class="panel-section"><div class="panel-subtitle">Building</div>
        <div class="panel-row" data-city-id="${cityOnTile.cityId}">
          <span>${tierName}</span>
          ${cityOnTile.isMyCity ? '<span class="label owned-label">Yours</span>' : ''}
        </div>
      </div>`;
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">${isRevealed ? '⚠ Revealed' : (BIOME_TRAVEL_NAMES[biome] || biome)}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style="${ownerColor !== '#888' ? 'color:' + ownerColor : ''}">${ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        <div class="panel-row"><span class="label">Units</span><span>${unitsOnTile.length}</span></div>
      </div>
      ${cityHtml}
      ${unitsHtml}
    `;

    document.getElementById('tile-deselect')?.addEventListener('click', () => {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
    });

    document.querySelectorAll('[data-unit-id]').forEach(el => {
      el.addEventListener('click', () => {
        const uid = (el as HTMLElement).dataset.unitId!;
        const unit = clientState.units.get(uid);
        this.suppressUpdate = true;
        try {
          clientState.selectedUnitId = uid;
          clientState.selectedCityId = null;
          clientState.pendingCommand = (unit && unit.status === 'IDLE' && unit.ownerId === clientState.myPlayerId) ? 'move' : null;
          notifySelectionChanged();
        } finally {
          this.suppressUpdate = false;
        }
      });
    });

    document.querySelectorAll('[data-city-id]').forEach(el => {
      el.addEventListener('click', () => {
        const cid = (el as HTMLElement).dataset.cityId!;
        this.suppressUpdate = true;
        try {
          clientState.selectedCityId = cid;
          clientState.selectedUnitId = null;
          clientState.pendingCommand = null;
          notifySelectionChanged();
        } finally {
          this.suppressUpdate = false;
        }
      });
    });
  }

  private bindPanelEvents(unit: { unitId: string; status: string }): void {
    document.getElementById('tile-deselect')?.addEventListener('click', () => {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
    });

    document.getElementById('back-to-tile')?.addEventListener('click', () => {
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
      notifySelectionChanged();
    });

    const moveBtn = document.getElementById('cmd-move');
    if (moveBtn) {
      moveBtn.addEventListener('click', () => {
        this.suppressUpdate = true;
        try {
          clientState.pendingCommand = clientState.pendingCommand === 'move' ? null : 'move';
          notifySelectionChanged();
        } finally {
          this.suppressUpdate = false;
        }
      });
    }

    const claimBtn = document.getElementById('cmd-claim');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const u = clientState.units.get(unit.unitId);
        if (u && u.status === 'IDLE' && u.cellId === clientState.selectedTileId) {
          const cellData = clientState.visibleCells.get(u.cellId);
          if (cellData && cellData.ownerId === clientState.myPlayerId) return;
          sendClaimTerritory(unit.unitId);
          clientState.pendingCommand = null;
          notifySelectionChanged();
        }
      });
    }

    const stopBtn = document.getElementById('cmd-stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        sendSetUnitIdle(unit.unitId);
        clientState.pendingCommand = null;
        notifySelectionChanged();
      });
    }

    const haltBtn = document.getElementById('unit-halt-btn');
    if (haltBtn) {
      haltBtn.addEventListener('click', () => {
        sendSetUnitIdle(unit.unitId);
      });
    }
  }

  private countUnitsOnTile(tileId: string): number {
    let count = 0;
    for (const [, unit] of clientState.units) {
      if (unit.cellId === tileId) count++;
    }
    return count;
  }
}