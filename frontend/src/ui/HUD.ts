import { clientState, onStateUpdate, notifySelectionChanged, getUnitActions, getCityActions } from '../state/ClientState';
import { sendMoveUnit, sendSetUnitIdle, sendCityQueueAddPriority, sendCityQueueAddRepeat, sendCityQueueRemoveRepeat, sendCityQueueClearPriority, sendClaimTerritory, sendBuildStructure, sendRestoreRuin } from '../network/ColyseusClient';
import {
  CFG,
  getPassableTerrain,
  getBuildingCosts,
  getBuildingPlacementRules,
  getUnitProductionCosts,
  getFoodValue,
  getMaterialValue,
  getEngineerBuildableTypes,
  getInfantryBuildableTypes,
  getResourceCategoryMap,
  TerrainType,
  CityData,
  ProductionItem,
} from '@vantaris/shared';

const PASSABLE_TERRAIN = getPassableTerrain(CFG);
const BUILDING_COSTS = getBuildingCosts(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);
const UNIT_PRODUCTION_COSTS = getUnitProductionCosts(CFG);
const FOOD_VALUE = getFoodValue(CFG);
const MATERIAL_VALUE = getMaterialValue(CFG);
const RESOURCE_CATEGORY_MAP = getResourceCategoryMap(CFG);

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
  BUILDING: 'Building',
};

const BUILDING_DISPLAY: Record<string, string> = {
  FARM: 'Farm',
  MINE: 'Mine',
  POWER_PLANT: 'Power Plant',
  OIL_WELL: 'Oil Well',
  LUMBER_CAMP: 'Lumber Camp',
  FACTORY: 'Factory',
  CITY: 'Settlement',
};

const RESOURCE_LABELS: Record<string, string> = {
  ORE: 'Ore',
  FOOD: 'Food',
  MATERIAL: 'Material',
  TIMBER: 'Timber',
  GRAIN: 'Grain',
  OIL: 'Oil',
  BREAD: 'Bread',
  STEEL: 'Steel',
  POWER: 'Power',
  LUMBER: 'Lumber',
};

export class HUD {
  private tooltip: HTMLElement;
  private wordmark: HTMLElement;
  private tickCounter: HTMLElement;
  private resourceBar: HTMLElement;
  private tilePanel: HTMLElement;
  private playerList: HTMLElement;
  private eliminationOverlay: HTMLElement;
  private suppressUpdate: boolean = false;
  private eliminationTimeout: ReturnType<typeof setTimeout> | null = null;
  private onDirectMessage: ((playerId: string) => void) | null = null;
  private lastPlayerListHash: string = '';
  private lastResourceHash: string = '';
  private lastTilePanelStructHash: string = '';
  private pendingUpdate: boolean = false;

  constructor() {
    this.tooltip = document.getElementById('hud-tooltip')!;
    this.wordmark = document.getElementById('hud-wordmark')!;
    this.tickCounter = document.getElementById('hud-tick')!;
    this.resourceBar = document.getElementById('hud-resources')!;
    this.tilePanel = document.getElementById('hud-tile-panel')!;
    this.playerList = document.getElementById('hud-player-list')!;
    this.eliminationOverlay = document.getElementById('hud-elimination')!;

    onStateUpdate(() => this.scheduleUpdate());
  }

  private scheduleUpdate(): void {
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;
    requestAnimationFrame(() => {
      this.pendingUpdate = false;
      this.onStateUpdate();
    });
  }

  private onStateUpdate(): void {
    this.updateTickCounter();
    this.updateResourceBar();
    this.updatePlayerList();
    this.updateTooltip();
    this.checkEliminationOverlay();
    this.checkGameWonOverlay();
    if (!this.suppressUpdate) {
      this.updateTilePanel();
    } else {
      this.lastTilePanelStructHash = '';
    }
  }

  private updateTilePanel(): void {
    const tileId = clientState.selectedTileId;
    if (!tileId) {
      if (this.lastTilePanelStructHash !== '') {
        this.lastTilePanelStructHash = '';
        this.tilePanel.classList.add('hidden');
      }
      return;
    }

    const cellData = clientState.visibleCells.get(tileId);
    const revealedData = clientState.revealedCells.get(tileId);

    if (!cellData && !revealedData) {
      if (this.lastTilePanelStructHash !== '') {
        this.lastTilePanelStructHash = '';
        this.tilePanel.classList.add('hidden');
      }
      return;
    }

    const selectedUnit = clientState.selectedUnitId ? clientState.units.get(clientState.selectedUnitId) : null;
    const selectedCity = clientState.selectedCityId ? clientState.cities.get(clientState.selectedCityId) : null;

    const structHash = this.computeTilePanelStructHash(tileId, cellData, revealedData, selectedUnit, selectedCity);

    if (structHash === this.lastTilePanelStructHash) {
      this.updateTilePanelDynamic(selectedUnit, selectedCity);
      return;
    }
    this.lastTilePanelStructHash = structHash;

    this.tilePanel.classList.remove('hidden');

    const biome = cellData ? cellData.biome : (revealedData ? revealedData.lastKnownBiome : '???');
    const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
    const isRevealed = !cellData && !!revealedData;

    const ownerPlayer = owner ? clientState.players.get(owner) : null;
    const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
    const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

    if (selectedUnit) {
      this.renderUnitPanel(selectedUnit, tileId, biome, ownerName, ownerColor, isRevealed);
    } else if (selectedCity) {
      this.renderCityPanel(selectedCity, tileId, biome, ownerName, ownerColor, isRevealed);
    } else {
      this.renderTilePanel(tileId, biome, ownerName, ownerColor, isRevealed);
    }
  }

  private computeTilePanelStructHash(
    tileId: string,
    cellData: any,
    revealedData: any,
    selectedUnit: any,
    selectedCity: any,
  ): string {
    const parts: string[] = [tileId];

    if (selectedUnit) {
      parts.push(`u:${selectedUnit.unitId},${selectedUnit.type},${selectedUnit.status},${selectedUnit.ownerId},${selectedUnit.engineerLevel},${clientState.pendingCommand}`);
    } else if (selectedCity) {
      parts.push(`c:${selectedCity.cityId},${selectedCity.tier},${selectedCity.repeatQueue.join(',')},${selectedCity.priorityQueue.map((p: any) => p.type).join(',')},${selectedCity.currentProduction?.type},${selectedCity.ownerId}`);
    } else {
      parts.push('t');
      for (const [uid, u] of clientState.units) {
        if (u.cellId === tileId) parts.push(`${uid}:${u.type}:${u.status}:${u.ownerId}`);
      }
    }

    if (cellData) {
      parts.push(`v:${cellData.ownerId},r:${cellData.ruin || ''},rr:${cellData.ruinRevealed},${cellData.resourceYield?.primary || 'NONE'},bc:${cellData.buildingCapacity},blds:${cellData.buildings.map((b: any) => `${b.buildingId}:${b.type}`).join(',')}`);
    } else if (revealedData) {
      parts.push(`r:${revealedData.lastKnownOwnerId},${revealedData.lastKnownRuin}`);
    }

    for (const [, b] of clientState.buildings) {
      if (b.cellId === tileId) {
        parts.push(`b:${b.buildingId},${b.type},${b.productionTicksRemaining > 0 ? 1 : 0}`);
      }
    }

    return parts.join('|');
  }

  private updateTilePanelDynamic(selectedUnit: any, selectedCity: any): void {
    if (selectedUnit) {
      const el = document.getElementById('panel-dynamic-status');
      if (el) {
        let statusText = STATUS_DISPLAY[selectedUnit.status] || selectedUnit.status;
        if (selectedUnit.status === 'MOVING' && selectedUnit.path && selectedUnit.path.length > 0) {
          statusText += ` — ${selectedUnit.path.length} tiles to go`;
        } else if (selectedUnit.status === 'BUILDING') {
          statusText = `Building — ${selectedUnit.buildTicksRemaining} ticks`;
        }
        el.textContent = statusText;
      }

      if (selectedUnit.status === 'MOVING') {
        const total = selectedUnit.movementTicksTotal || 10;
        const remaining = selectedUnit.movementTicksRemaining;
        const pct = Math.round(((total - remaining) / total) * 100);
        const fill = document.getElementById('panel-dynamic-progress-fill');
        if (fill) fill.style.width = `${pct}%`;
      } else if (selectedUnit.status === 'CLAIMING') {
        const maxTicks = selectedUnit.claimTicksRemaining > 100 ? 300 : 50;
        const pct = Math.round(((maxTicks - selectedUnit.claimTicksRemaining) / maxTicks) * 100);
        const fill = document.getElementById('panel-dynamic-progress-fill');
        if (fill) fill.style.width = `${pct}%`;
        const ticks = document.getElementById('panel-dynamic-claim-ticks');
        if (ticks) ticks.textContent = `${selectedUnit.claimTicksRemaining} ticks`;
      }
    } else if (selectedCity) {
      const xpPct = selectedCity.xpToNext > 0 ? Math.min(100, Math.round((selectedCity.xp / selectedCity.xpToNext) * 100)) : 100;
      const xpFill = document.getElementById('panel-dynamic-xp-fill');
      if (xpFill) xpFill.style.width = `${xpPct}%`;

      const xpText = document.getElementById('panel-dynamic-xp-text');
      if (xpText) xpText.textContent = `${selectedCity.xp} / ${selectedCity.xpToNext}`;

      const popEl = document.getElementById('panel-dynamic-pop');
      if (popEl) popEl.textContent = `${selectedCity.population}`;

      if (selectedCity.currentProduction) {
        const prodTicksTotal = selectedCity.productionTicksTotal;
        const pct = Math.round(((prodTicksTotal - selectedCity.productionTicksRemaining) / prodTicksTotal) * 100);
        const prodFill = document.getElementById('panel-dynamic-prod-fill');
        if (prodFill) prodFill.style.width = `${pct}%`;
        const prodTicks = document.getElementById('panel-dynamic-prod-ticks');
        if (prodTicks) prodTicks.textContent = `${selectedCity.productionTicksRemaining} ticks`;
      }

      const stockpileEl = document.getElementById('panel-dynamic-stockpile');
      if (stockpileEl && selectedCity) {
        stockpileEl.innerHTML = this.buildStockpileHtml(selectedCity);
      }
    }
  }

  private buildStockpileHtml(city: any): string {
    const round1 = (v: number) => Math.round(v * 10) / 10;
    const CATEGORY_ORDER = ['FOOD', 'INDUSTRY', 'ENERGY', 'POPULATION'];
    const CATEGORY_LABELS: Record<string, string> = { FOOD: 'Food', INDUSTRY: 'Industry', ENERGY: 'Energy', POPULATION: 'Population' };
    const CATEGORY_ICONS: Record<string, string> = { FOOD: '\u{1F33E}', INDUSTRY: '\u2692', ENERGY: '\u26A1', POPULATION: '\u{1F465}' };

    const categoryStockpile: Record<string, { resources: { resource: string; amount: number; label: string }[]; total: number }> = {};
    const inflowMap: Record<string, { total: number; sources: { source: string; amount: number }[] }> = {};
    for (const cat of CATEGORY_ORDER) {
      categoryStockpile[cat] = { resources: [], total: 0 };
      inflowMap[cat] = { total: 0, sources: [] };
    }
    for (const entry of city.stockpile) {
      const cat = RESOURCE_CATEGORY_MAP[entry.resource] || 'INDUSTRY';
      const label = RESOURCE_LABELS[entry.resource] || entry.resource;
      categoryStockpile[cat].resources.push({ resource: entry.resource, amount: round1(entry.amount), label });
      categoryStockpile[cat].total += entry.amount;
    }
    for (const inflow of (city.resourceInflows || [])) {
      const cat = RESOURCE_CATEGORY_MAP[inflow.resource] || 'INDUSTRY';
      const existing = inflowMap[cat].sources.find((s: any) => s.source === inflow.source);
      if (existing) {
        existing.amount = round1(existing.amount + inflow.amount);
      } else {
        inflowMap[cat].sources.push({ source: inflow.source, amount: round1(inflow.amount) });
      }
      inflowMap[cat].total = round1(inflowMap[cat].total + inflow.amount);
    }

    const foodSatPct = Math.round(city.foodPerTick * 100);
    const energySatPct = Math.round(city.energyPerTick * 100);
    const manPower = city.tier ? (CFG.CITY.TIER_MANPOWER[city.tier] ?? 2) : 2;
    const popGrowthRate = city.foodPerTick >= 1.0
      ? CFG.CITY.POPULATION_GROWTH_BASE + CFG.CITY.POPULATION_GROWTH_FOOD_BONUS * city.foodPerTick
      : 0;

    let html = '<div class="panel-subtitle">Stockpile</div>';
    for (const cat of CATEGORY_ORDER) {
      if (cat === 'POPULATION') {
        const popLabel = popGrowthRate > 0 ? `${city.population} (${popGrowthRate > 0 ? '+' : ''}${round1(popGrowthRate)}/t)` : `${city.population}`;
        html += `<div class="panel-row stockpile-category">`;
        html += `<span class="label">${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}</span>`;
        html += `<span>${popLabel}</span>`;
        html += `</div>`;
        html += `<div class="panel-row stockpile-resource"><span class="label resource-indent">Manpower</span><span>${manPower}</span></div>`;
        continue;
      }
      const data = categoryStockpile[cat];
      if (data.resources.length === 0 && cat !== 'ENERGY') continue;

      let satLabel = '';
      if (cat === 'FOOD') satLabel = foodSatPct !== 100 ? ` (${foodSatPct}%)` : '';
      if (cat === 'ENERGY') satLabel = energySatPct !== 100 ? ` (${energySatPct}%)` : '';

      const inflow = inflowMap[cat];
      const inflowTooltip = inflow.sources.length > 0
        ? inflow.sources.map((s: any) => `${s.source}: +${round1(s.amount)}`).join('\\n')
        : '';
      const inflowLabel = inflow.total > 0 ? ` (+${round1(inflow.total)}/100t)` : '';

      html += `<div class="panel-row stockpile-category" ${inflowTooltip ? `title="${inflowTooltip}"` : ''}>`;
      html += `<span class="label">${CATEGORY_ICONS[cat]} ${CATEGORY_LABELS[cat]}${satLabel}</span>`;
      html += `<span>${round1(data.total)}${inflowLabel}</span>`;
      html += `</div>`;
      for (const r of data.resources) {
        html += `<div class="panel-row stockpile-resource">`;
        html += `<span class="label resource-indent">${r.label}</span>`;
        html += `<span>${r.amount}</span>`;
        html += `</div>`;
      }
    }
    return html;
  }

  private updateTooltip(): void {
    const hoveredId = clientState.hoveredCellId;
    if (!hoveredId) {
      this.tooltip.classList.add('hidden');
      return;
    }

    const cellData = clientState.visibleCells.get(hoveredId);
    const revealedData = clientState.revealedCells.get(hoveredId);

    if (!cellData && !revealedData) {
      this.tooltip.classList.add('hidden');
      return;
    }

    this.tooltip.classList.remove('hidden');

    const tx = Math.min(clientState.mouseClientX + 16, window.innerWidth - 180);
    const ty = Math.min(clientState.mouseClientY + 16, window.innerHeight - 80);
    this.tooltip.style.left = `${tx}px`;
    this.tooltip.style.top = `${ty}px`;
    this.tooltip.style.right = 'auto';

    const biome = cellData ? cellData.biome : (revealedData ? revealedData.lastKnownBiome : '???');
    const biomeText = BIOME_TRAVEL_NAMES[biome] || biome || '???';
    const fog = cellData ? 'VISIBLE' : 'REVEALED';
    const fogLabel = fog === 'VISIBLE' ? 'Visible' : 'Revealed';

    const owner = cellData ? cellData.ownerId : (revealedData ? revealedData.lastKnownOwnerId : '');
    const ownerPlayer = owner ? clientState.players.get(owner) : null;
    const ownerName = ownerPlayer ? ownerPlayer.displayName : (owner ? 'Unknown' : 'Unclaimed');
    const ownerColor = ownerPlayer ? ownerPlayer.color : '#888';

    const RUIN_LABELS: Record<string, string> = {
      RUINED_CITY: 'Ruined City',
      RUINED_FACTORY: 'Ruined Factory',
      RUINED_PORT: 'Ruined Port',
      RUINED_BARRACKS: 'Ruined Barracks',
      COLLAPSED_MINE: 'Collapsed Mine',
      OVERGROWN_FARM: 'Overgrown Farm',
    };

    let ruinHtml = '';
    if (cellData && cellData.ruin && cellData.ruinRevealed) {
      ruinHtml = `<div class="tooltip-ruin">${RUIN_LABELS[cellData.ruin] || cellData.ruin}</div>`;
    } else if (cellData && cellData.ruin && !cellData.ruinRevealed) {
      ruinHtml = '<div class="tooltip-ruin">Ruin (unexplored)</div>';
    } else if (revealedData && revealedData.lastKnownRuin) {
      ruinHtml = `<div class="tooltip-ruin">${RUIN_LABELS[revealedData.lastKnownRuin] || revealedData.lastKnownRuin}</div>`;
    } else if (clientState.ruinMarkers.has(hoveredId)) {
      ruinHtml = '<div class="tooltip-ruin">Ruin detected</div>';
    }

    let resourceHtml = '';
    if (cellData && cellData.resourceYield && cellData.resourceYield.primary !== 'NONE') {
      const label = RESOURCE_LABELS[cellData.resourceYield.primary] || cellData.resourceYield.primary;
      resourceHtml = `<div class="tooltip-resource">${label} +${cellData.resourceYield.amount}</div>`;
    }

    let buildingHtml = '';
    if (cellData && cellData.buildings.length > 0) {
      const parts = cellData.buildings.map((b: any) => {
        const bType = BUILDING_DISPLAY[b.type] || b.type;
        const underConstruction = b.productionTicksRemaining > 0;
        return `${bType}${underConstruction ? ` (${b.productionTicksRemaining}t)` : ''}`;
      });
      buildingHtml = `<div class="tooltip-building">${parts.join(', ')}</div>`;
    }

    this.tooltip.innerHTML = `
      <div class="tooltip-biome">${biomeText}</div>
      <div class="tooltip-owner" style="color:${ownerColor}">${ownerName}</div>
      ${ruinHtml}
      ${resourceHtml}
      ${buildingHtml}
      <div class="tooltip-fog">${fogLabel}</div>
    `;
  }

  private updateTickCounter(): void {
    const cycle = clientState.dayNightCycleTicks || 600;
    const phase = ((clientState.sunAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const cyclePct = Math.round((phase / (Math.PI * 2)) * 100);
    const isNight = Math.cos(phase) < 0;
    const icon = isNight ? '☽' : '☀';
    this.tickCounter.textContent = `Tick: ${clientState.currentTick}  ${icon}`;
  }

  private updateResourceBar(): void {
    if (!clientState.myPlayerId) {
      this.resourceBar.classList.add('hidden');
      return;
    }
    this.resourceBar.classList.remove('hidden');

    const r = clientState.resources;
    const hash = `${r.food},${r.energy},${r.manpower},${r.foodPerTick},${r.energyPerTick},${r.manpowerPerTick},${r.totalPopulation},${r.factoryCount}`;
    if (hash === this.lastResourceHash) return;
    this.lastResourceHash = hash;

    this.resourceBar.innerHTML = `
      <div class="res-item"><span class="res-icon food-icon">☘</span><span class="res-val">${r.food}</span><span class="res-rate">+${r.foodPerTick}/t</span></div>
      <div class="res-item"><span class="res-icon energy-icon">⚡</span><span class="res-val">${r.energy}</span><span class="res-rate">+${r.energyPerTick}/t</span></div>
      <div class="res-item"><span class="res-icon manpower-icon">⊕</span><span class="res-val">${r.manpower}</span><span class="res-rate">+${r.manpowerPerTick}/t</span></div>
      <div class="res-sep"></div>
      <div class="res-item"><span class="res-icon pop-icon">⚑</span><span class="res-val">${r.totalPopulation}</span></div>
      <div class="res-item"><span class="res-icon factory-icon">⚙</span><span class="res-val">${r.factoryCount}</span></div>
      <div class="res-item"><span class="res-icon army-icon">⦿</span><span class="res-val">${Array.from(clientState.units.values()).filter(u => u.ownerId === clientState.myPlayerId).length}</span></div>
    `;
  }

  private updatePlayerList(): void {
    const players: { playerId: string; displayName: string; color: string; alive: boolean; territoryCount: number; unitCount: number; cityCount: number }[] = [];
    for (const [, p] of clientState.players) {
      players.push({
        playerId: p.playerId,
        displayName: p.displayName,
        color: p.color,
        alive: p.alive,
        territoryCount: p.territoryCount,
        unitCount: p.unitCount,
        cityCount: p.cityCount,
      });
    }

    players.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.territoryCount - a.territoryCount;
    });

    const hash = players.map(p => `${p.playerId},${p.alive},${p.territoryCount},${p.unitCount},${p.cityCount}`).join('|');
    if (hash === this.lastPlayerListHash) return;
    this.lastPlayerListHash = hash;

    let html = '<div class="plist-header">CONTESTANTS</div>';
    for (const p of players) {
      const isYou = p.playerId === clientState.myPlayerId;
      const dot = p.alive
        ? `<span class="plist-dot" style="background:${p.color}"></span>`
        : `<span class="plist-dot plist-dot-dead" style="border-color:${p.color}"></span>`;
      const tag = isYou ? '<span class="plist-you">[you]</span>' : '';
      const deadTag = !p.alive ? '<span class="plist-dead">[dead]</span>' : '';
      const stats = p.alive ? `<span class="plist-stats">${p.territoryCount}hex ${p.cityCount}city ${p.unitCount}mil</span>` : '';
      const dmBtn = (!isYou && p.alive) ? `<button class="plist-dm-btn" data-player-id="${p.playerId}" title="Send direct message">&#9993;</button>` : '';
      html += `<div class="plist-row${!p.alive ? ' plist-row-dead' : ''}">
        ${dot}
        <span class="plist-name">${p.displayName}${tag}${deadTag}</span>
        ${dmBtn}
        ${stats}
      </div>`;
    }
    this.playerList.innerHTML = html;

    this.playerList.querySelectorAll('.plist-dm-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const playerId = (btn as HTMLElement).dataset.playerId!;
        if (this.onDirectMessage) {
          this.onDirectMessage(playerId);
        }
      });
    });
  }

  private checkEliminationOverlay(): void {
    if (!clientState.eliminationEvent) return;
    const evt = clientState.eliminationEvent;
    clientState.eliminationEvent = null;

    const survived = evt.eliminatedTick;
    this.eliminationOverlay.innerHTML = `
      <div class="elim-border">
        <div class="elim-header">CHANNEL 66 &nbsp;|&nbsp; VANTARIS TOURNAMENT</div>
        <div class="elim-title">CONTESTANT ELIMINATED</div>
        <div class="elim-name" style="color:${evt.color}">${evt.displayName}</div>
        <div class="elim-survived">Survived ${survived} ticks</div>
      </div>
    `;
    this.eliminationOverlay.classList.remove('hidden');
    this.eliminationOverlay.classList.add('elim-show');

    if (this.eliminationTimeout) clearTimeout(this.eliminationTimeout);
    this.eliminationTimeout = setTimeout(() => {
      this.eliminationOverlay.classList.remove('elim-show');
      this.eliminationOverlay.classList.add('hidden');
    }, 4000);
  }

  private checkGameWonOverlay(): void {
    if (!clientState.gameWonEvent) return;
    const evt = clientState.gameWonEvent;
    clientState.gameWonEvent = null;

    this.eliminationOverlay.innerHTML = `
      <div class="elim-border">
        <div class="elim-header">CHANNEL 66 &nbsp;|&nbsp; VANTARIS TOURNAMENT</div>
        <div class="elim-title">WINNER DECLARED</div>
        <div class="elim-name" style="color:${evt.color}">${evt.displayName}</div>
      </div>
    `;
    this.eliminationOverlay.classList.remove('hidden');
    this.eliminationOverlay.classList.add('elim-show');

    if (this.eliminationTimeout) clearTimeout(this.eliminationTimeout);
  }

  private renderUnitPanel(unit: { unitId: string; ownerId: string; type: string; status: string; cellId: string; path: string[]; movementTicksRemaining: number; movementTicksTotal: number; claimTicksRemaining: number; buildTicksRemaining: number; engineerLevel: number }, tileId: string, biome: string, ownerName: string, ownerColor: string, isRevealed: boolean): void {
    const isMyUnit = unit.ownerId === clientState.myPlayerId;
    const player = clientState.players.get(unit.ownerId);
    const unitColor = player ? player.color : '#888';
    const pendingCommand = clientState.pendingCommand;

    const unitTypeLabel = unit.type === 'ENGINEER' ? 'Engineer' : unit.type;

    let statusText = STATUS_DISPLAY[unit.status] || unit.status;
    if (unit.status === 'MOVING' && unit.path && unit.path.length > 0) {
      statusText += ` — ${unit.path.length} tiles to go`;
    } else if (unit.status === 'BUILDING') {
      statusText = `Building — ${unit.buildTicksRemaining} ticks`;
    }

    let progressHtml = '';
    if (unit.status === 'MOVING') {
      const total = unit.movementTicksTotal || 10;
      const remaining = unit.movementTicksRemaining;
      const pct = Math.round(((total - remaining) / total) * 100);
      progressHtml = `<div class="progress-bar"><div class="progress-fill" id="panel-dynamic-progress-fill" style="width: ${pct}%"></div></div>`;
    } else if (unit.status === 'CLAIMING') {
      const maxTicks = unit.claimTicksRemaining > 100 ? 300 : 50;
      const pct = Math.round(((maxTicks - unit.claimTicksRemaining) / maxTicks) * 100);
      progressHtml = `<div class="progress-bar"><div class="progress-fill claim-fill" id="panel-dynamic-progress-fill" style="width: ${pct}%"></div></div>
        <div class="panel-row"><span class="label">Claiming</span><span id="panel-dynamic-claim-ticks">${unit.claimTicksRemaining} ticks</span></div>`;
    } else if (unit.status === 'BUILDING') {
      progressHtml = `<div class="progress-bar"><div class="progress-fill build-fill" style="width: 100%"></div></div>`;
    }

    let commandsHtml = '';
    if (isMyUnit && unit.status === 'IDLE') {
      const cellData = clientState.visibleCells.get(unit.cellId);
      const alreadyOwnsTile = cellData && cellData.ownerId === clientState.myPlayerId;
      const moveActive = pendingCommand === 'move' ? ' active' : '';
      const claimButton = (alreadyOwnsTile || unit.type !== 'INFANTRY') ? '' : `<button class="panel-btn cmd-btn" id="cmd-claim" title="Claim the tile this unit is standing on">2 Claim<span class="cmd-key">2</span></button>`;

      let buildButton = '';
      if (cellData && cellData.ownerId === clientState.myPlayerId) {
        const canBuildTypes = unit.type === 'ENGINEER'
          ? getEngineerBuildableTypes(CFG,unit.engineerLevel)
          : getInfantryBuildableTypes(CFG);

        if (cellData.ruin && cellData.ruinRevealed) {
          buildButton = `<button class="panel-btn cmd-btn" id="cmd-restore" title="Restore this ruin">3 Restore<span class="cmd-key">3</span></button>`;
        } else if (canBuildTypes.length > 0) {
          const placeableTypes = canBuildTypes.filter((bt: string) => {
            const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
            if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) return false;
            if (bt === 'CITY') {
              let cellHasCity = false;
              for (const [, c] of clientState.cities) { if (c.cellId === unit.cellId) { cellHasCity = true; break; } }
              return !cellHasCity;
            }
            return cellData.buildings.length < cellData.buildingCapacity;
          });
          if (placeableTypes.length > 0) {
            buildButton = `<button class="panel-btn cmd-btn" id="cmd-build" title="Build a structure on this hex">3 Build<span class="cmd-key">3</span></button>`;
          }
        }
      }

      commandsHtml = `<div class="panel-actions">
        <button class="panel-btn cmd-btn${moveActive}" id="cmd-move" title="Click a destination tile to move there">1 Move<span class="cmd-key">1</span></button>
        ${claimButton}
        ${buildButton}
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

    let buildOptionsHtml = '';
    if (isMyUnit && unit.status === 'IDLE') {
      const cellData = clientState.visibleCells.get(unit.cellId);
      if (cellData && cellData.ownerId === clientState.myPlayerId && !(unit.type === 'ENGINEER' && cellData.ruin && cellData.ruinRevealed)) {
        const canBuildTypes = unit.type === 'ENGINEER'
          ? getEngineerBuildableTypes(CFG,unit.engineerLevel)
          : getInfantryBuildableTypes(CFG);
        const allBuildable = unit.type === 'ENGINEER'
          ? ['FARM', 'MINE', 'OIL_WELL', 'LUMBER_CAMP', 'FACTORY', 'CITY']
          : getInfantryBuildableTypes(CFG);
        const nextLevelTypes = unit.type === 'ENGINEER'
          ? getEngineerBuildableTypes(CFG,unit.engineerLevel + 1).filter((bt: string) => !canBuildTypes.includes(bt))
          : [];

        for (const bt of allBuildable) {
          const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
          const biomeOk = !allowedBiomes || allowedBiomes.includes(cellData.biome);
          const canBuildByLevel = canBuildTypes.includes(bt);
          const isNextLevel = nextLevelTypes.includes(bt);
          let capacityOk = false;
          if (bt === 'CITY') {
            let cellHasCity = false;
            for (const [, c] of clientState.cities) { if (c.cellId === unit.cellId) { cellHasCity = true; break; } }
            capacityOk = !cellHasCity;
          } else {
            capacityOk = cellData.buildings.length < cellData.buildingCapacity;
          }
          const available = canBuildByLevel && biomeOk && capacityOk;

          const cost = BUILDING_COSTS[bt];
          const isFree = !cost || (cost.food === 0 && cost.material === 0);
          let costLabel = 'Free';
          if (cost && (cost.food > 0 || cost.material > 0)) {
            const parts: string[] = [];
            if (cost.food > 0) parts.push(`\ud83c\udf5e ${cost.food}`);
            if (cost.material > 0) parts.push(`\ud83e\udea8 ${cost.material}`);
            costLabel = parts.join(' ');
          }
          const consumesNote = cost?.consumesBuilder ? ' \u26a0 Consumes unit' : '';
          const displayName = BUILDING_DISPLAY[bt] || bt;
          const dimClass = !available ? ' build-option-dimmed' : '';
          const levelNote = !canBuildByLevel && isNextLevel ? ' <span class="build-option-note">Requires Lv.2</span>' : !canBuildByLevel ? ' <span class="build-option-note">Locked</span>' : '';
          const biomeNote = canBuildByLevel && !biomeOk ? ' <span class="build-option-note">Wrong biome</span>' : '';
          const capNote = canBuildByLevel && biomeOk && !capacityOk ? ' <span class="build-option-note">Full</span>' : '';

          buildOptionsHtml += `<div class="build-option${dimClass}" data-build-type="${bt}" data-unit-id="${unit.unitId}" data-cell-id="${unit.cellId}" title="${costLabel}${consumesNote}">
            <span class="build-option-name">${displayName}</span>
            <span class="build-option-cost">${isFree ? '\u2713 Free' : costLabel}${consumesNote}</span>
            ${levelNote}${biomeNote}${capNote}
          </div>`;
        }
      }
    }

    const unitsOnTile: string[] = [];
    for (const [uid, u] of clientState.units) {
      if (u.cellId === tileId) unitsOnTile.push(uid);
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title" style="color: ${unitColor}">⦿ ${unitTypeLabel}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Status</span><span id="panel-dynamic-status">${statusText}</span></div>
        <div class="panel-row"><span class="label">Owner</span><span style="color: ${ownerColor}">${ownerName}${isMyUnit ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        ${unitsOnTile.length > 1 ? `<div class="panel-row"><span class="label">Stack</span><span>${unitsOnTile.length} units</span></div>` : ''}
      </div>
      ${progressHtml}
      ${commandsHtml}
      ${buildOptionsHtml ? `<div class="panel-section"><div class="panel-subtitle">Build Options</div>${buildOptionsHtml}</div>` : ''}
      <div class="panel-section panel-back-link">
        <button class="panel-btn panel-btn-secondary" id="back-to-tile">← Tile info</button>
      </div>
    `;

    this.bindPanelEvents(unit);
  }

  private renderCityPanel(city: CityData, tileId: string, biome: string, ownerName: string, ownerColor: string, isRevealed: boolean): void {
    const isMyCity = city.ownerId === clientState.myPlayerId;
    const tierName = TIER_NAMES[city.tier] || 'Settlement';
    const player = clientState.players.get(city.ownerId);
    const cityColor = player ? player.color : '#888';

    const maxUnits = city.tier + 1;
    const unitsHere = this.countUnitsOnTile(tileId);

    const xpPct = city.xpToNext > 0 ? Math.min(100, Math.round((city.xp / city.xpToNext) * 100)) : 100;

    const typeLabel = (t: string) => t === 'ENGINEER' ? 'Engineer' : t === 'INFANTRY' ? 'Infantry' : t;

    let productionHtml = '';
    if (city.currentProduction) {
      const pct = city.productionTicksTotal > 0 ? Math.round(((city.productionTicksTotal - city.productionTicksRemaining) / city.productionTicksTotal) * 100) : 0;
      productionHtml = `<div class="panel-section">
        <div class="panel-subtitle">Production</div>
        <div class="panel-row"><span class="label">Building</span><span>${typeLabel(city.currentProduction.type)}</span></div>
        <div class="progress-bar"><div class="progress-fill" id="panel-dynamic-prod-fill" style="width: ${pct}%"></div></div>
        <div class="panel-row"><span class="label">Ready in</span><span id="panel-dynamic-prod-ticks">${city.productionTicksRemaining} ticks</span></div>
      </div>`;
    }

    let queueHtml = '';
    if (city.priorityQueue.length > 0 || city.repeatQueue.length > 0) {
      queueHtml = '<div class="panel-section"><div class="panel-subtitle">Queue</div>';
      for (let i = 0; i < city.priorityQueue.length; i++) {
        const item = city.priorityQueue[i];
        const prodCost = UNIT_PRODUCTION_COSTS.find(c => c.type === item.type);
        const resParts = prodCost ? Object.entries(prodCost.resourceCost).map(([r, a]) => `${RESOURCE_LABELS[r] || r}: ${a}`).join(', ') : '';
        const tooltip = prodCost ? `${resParts}${prodCost.manpowerCost ? ', Pop: ' + prodCost.manpowerCost : ''}, Ticks: ${prodCost.ticksCost}` : '';
        queueHtml += `<div class="panel-row queue-item" title="${tooltip}">
          <button class="queue-toggle-btn" data-queue-toggle-to-repeat="${i}" data-city-id="${city.cityId}" data-unit-type="${item.type}" title="Toggle infinite ON">∞</button>
          <span>▸ ${typeLabel(item.type)}</span>
          <button class="queue-remove-btn" data-queue-remove-priority="${i}" data-city-id="${city.cityId}" title="Remove">✕</button>
        </div>`;
      }
      for (let i = 0; i < city.repeatQueue.length; i++) {
        const unitType = city.repeatQueue[i];
        const prodCost = UNIT_PRODUCTION_COSTS.find(c => c.type === unitType);
        const resParts = prodCost ? Object.entries(prodCost.resourceCost).map(([r, a]) => `${RESOURCE_LABELS[r] || r}: ${a}`).join(', ') : '';
        const tooltip = prodCost ? `${resParts}${prodCost.manpowerCost ? ', Pop: ' + prodCost.manpowerCost : ''}, Ticks: ${prodCost.ticksCost}` : '';
        queueHtml += `<div class="panel-row queue-item" title="${tooltip}">
          <button class="queue-toggle-btn queue-toggle-active" data-queue-toggle-to-priority="${i}" data-city-id="${city.cityId}" data-unit-type="${unitType}" title="Toggle infinite OFF">∞</button>
          <span>${typeLabel(unitType)}</span>
          <button class="queue-remove-btn" data-queue-remove-repeat="${i}" data-city-id="${city.cityId}" title="Remove">✕</button>
        </div>`;
      }
      queueHtml += '</div>';
    }

    let actionsHtml = '';
    if (isMyCity) {
      actionsHtml = `<div class="panel-actions city-queue-actions">
        <button class="panel-btn" id="city-queue-priority-infantry" title="Add Infantry (one-shot)">${typeLabel('INFANTRY')}</button>
        <button class="panel-btn" id="city-queue-priority-engineer" title="Add Engineer (one-shot)">${typeLabel('ENGINEER')}</button>
      </div>`;
    }

    const buildingsOnTile: { type: string; ticks: number }[] = [];
    for (const [, b] of clientState.buildings) {
      if (b.cellId === tileId) {
        buildingsOnTile.push({ type: b.type, ticks: b.productionTicksRemaining });
      }
    }

    let buildingsHtml = '';
    if (buildingsOnTile.length > 0) {
      buildingsHtml = '<div class="panel-section"><div class="panel-subtitle">Buildings</div>';
      for (const b of buildingsOnTile) {
        const label = BUILDING_DISPLAY[b.type] || b.type;
        const status = b.ticks > 0 ? ` (${b.ticks}t)` : '';
        buildingsHtml += `<div class="panel-row"><span class="label">${label}</span><span>${status || 'Active'}</span></div>`;
      }
      buildingsHtml += '</div>';
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title" style="color: ${cityColor}">⌂ ${tierName}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style="color: ${ownerColor}">${ownerName}${isMyCity ? ' (You)' : ''}</span></div>
        <div class="panel-row"><span class="label">Tier</span><span>${tierName} (Lv.${city.tier})</span></div>
        <div class="panel-row"><span class="label">Population</span><span id="panel-dynamic-pop">${city.population}</span></div>
        <div class="panel-row"><span class="label">Garrison</span><span>${unitsHere} / ${maxUnits}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        <div class="panel-row"><span class="label">XP</span><span id="panel-dynamic-xp-text">${city.xp} / ${city.xpToNext}</span></div>
        <div class="progress-bar small"><div class="progress-fill" id="panel-dynamic-xp-fill" style="width: ${xpPct}%"></div></div>
      </div>
      <div id="panel-dynamic-stockpile" class="panel-section">${this.buildStockpileHtml(city)}</div>
      ${productionHtml}
      ${queueHtml}
      ${buildingsHtml}
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

    const prioEngBtn = document.getElementById('city-queue-priority-engineer');
    if (prioEngBtn) {
      prioEngBtn.addEventListener('click', () => {
        this.suppressUpdate = true;
        try {
          sendCityQueueAddPriority(city.cityId, 'ENGINEER');
        } finally {
          this.suppressUpdate = false;
        }
      });
    }

    const prioInfBtn = document.getElementById('city-queue-priority-infantry');
    if (prioInfBtn) {
      prioInfBtn.addEventListener('click', () => {
        this.suppressUpdate = true;
        try {
          sendCityQueueAddPriority(city.cityId, 'INFANTRY');
        } finally {
          this.suppressUpdate = false;
        }
      });
    }

    document.querySelectorAll('[data-queue-remove-priority]').forEach(el => {
      el.addEventListener('click', () => {
        const cityId = (el as HTMLElement).dataset.cityId!;
        this.suppressUpdate = true;
        try {
          sendCityQueueClearPriority(cityId);
        } finally {
          this.suppressUpdate = false;
        }
      });
    });

    document.querySelectorAll('[data-queue-remove-repeat]').forEach(el => {
      el.addEventListener('click', () => {
        const cityId = (el as HTMLElement).dataset.cityId!;
        const index = parseInt((el as HTMLElement).dataset.queueRemoveRepeat!, 10);
        this.suppressUpdate = true;
        try {
          sendCityQueueRemoveRepeat(cityId, index);
        } finally {
          this.suppressUpdate = false;
        }
      });
    });

    document.querySelectorAll('[data-queue-toggle-to-repeat]').forEach(el => {
      el.addEventListener('click', () => {
        const cityId = (el as HTMLElement).dataset.cityId!;
        const unitType = (el as HTMLElement).dataset.unitType!;
        this.suppressUpdate = true;
        try {
          sendCityQueueAddRepeat(cityId, unitType);
          sendCityQueueClearPriority(cityId);
        } finally {
          this.suppressUpdate = false;
        }
      });
    });

    document.querySelectorAll('[data-queue-toggle-to-priority]').forEach(el => {
      el.addEventListener('click', () => {
        const cityId = (el as HTMLElement).dataset.cityId!;
        const index = parseInt((el as HTMLElement).dataset.queueToggleToPriority!, 10);
        const unitType = (el as HTMLElement).dataset.unitType!;
        this.suppressUpdate = true;
        try {
          sendCityQueueAddPriority(cityId, unitType);
          sendCityQueueRemoveRepeat(cityId, index);
        } finally {
          this.suppressUpdate = false;
        }
      });
    });
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
        cityOnTile = { cityId, tier: city.tier, producing: city.repeatQueue.length > 0 || city.currentProduction !== null, isMyCity: city.ownerId === clientState.myPlayerId };
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

    const buildingsOnTile: { buildingId: string; type: string; isMine: boolean }[] = [];
    for (const [buildingId, b] of clientState.buildings) {
      if (b.cellId === tileId) {
        buildingsOnTile.push({ buildingId, type: b.type, isMine: b.ownerId === clientState.myPlayerId });
      }
    }
    let buildingsListHtml = '';
    if (buildingsOnTile.length > 0) {
      buildingsListHtml = '<div class="panel-section"><div class="panel-subtitle">Structures</div>';
      for (const b of buildingsOnTile) {
        const label = BUILDING_DISPLAY[b.type] || b.type;
        buildingsListHtml += `<div class="panel-row">
          <span>${label}</span>
          ${b.isMine ? '<span class="label owned-label">Yours</span>' : ''}
        </div>`;
      }
      buildingsListHtml += '</div>';
    }

    const cellData = clientState.visibleCells.get(tileId);
    let resourceHtml = '';
    if (cellData && cellData.resourceYield && cellData.resourceYield.primary !== 'NONE') {
      const label = RESOURCE_LABELS[cellData.resourceYield.primary] || cellData.resourceYield.primary;
      resourceHtml = `<div class="panel-row"><span class="label">Resource</span><span>${label} +${cellData.resourceYield.amount}</span></div>`;
    }

    this.tilePanel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">${isRevealed ? '⚠ Revealed' : (BIOME_TRAVEL_NAMES[biome] || biome)}</span>
        <button class="panel-close" id="tile-deselect">&times;</button>
      </div>
      <div class="panel-section">
        <div class="panel-row"><span class="label">Owner</span><span style="${ownerColor !== '#888' ? 'color:' + ownerColor : ''}">${ownerName}</span></div>
        <div class="panel-row"><span class="label">Terrain</span><span>${BIOME_TRAVEL_NAMES[biome] || biome}</span></div>
        ${resourceHtml}
        <div class="panel-row"><span class="label">Units</span><span>${unitsOnTile.length}</span></div>
      </div>
      ${cityHtml}
      ${buildingsListHtml}
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

  private bindPanelEvents(unit: { unitId: string; status: string; type: string; engineerLevel: number; cellId: string }): void {
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

    const buildBtn = document.getElementById('cmd-build');
    if (buildBtn) {
      buildBtn.addEventListener('click', () => {
        const u = clientState.units.get(unit.unitId);
        if (u && u.status === 'IDLE' && u.type === 'ENGINEER') {
          const cellData = clientState.visibleCells.get(u.cellId);
          if (cellData && cellData.ownerId === clientState.myPlayerId && !cellData.ruin) {
            const allowedTypes = getEngineerBuildableTypes(CFG,u.engineerLevel);
            const freeExtractor = allowedTypes.find((bt: string) => {
              const cost = BUILDING_COSTS[bt];
              return cost && cost.food === 0 && cost.material === 0 && BUILDING_PLACEMENT_RULES[bt]?.includes(cellData.biome);
            });
            if (freeExtractor) {
              sendBuildStructure(unit.unitId, freeExtractor, u.cellId);
              clientState.pendingCommand = null;
              notifySelectionChanged();
            }
          }
        }
      });
    }

    document.querySelectorAll('.build-option:not(.build-option-dimmed)').forEach(el => {
      el.addEventListener('click', () => {
        const buildingType = (el as HTMLElement).dataset.buildType!;
        const unitId = (el as HTMLElement).dataset.unitId!;
        const cellId = (el as HTMLElement).dataset.cellId!;
        const u = clientState.units.get(unitId);
        if (u && u.status === 'IDLE') {
          sendBuildStructure(unitId, buildingType, cellId);
          clientState.pendingCommand = null;
          this.suppressUpdate = true;
          try {
            notifySelectionChanged();
          } finally {
            this.suppressUpdate = false;
          }
        }
      });
    });

    const restoreBtn = document.getElementById('cmd-restore');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        const u = clientState.units.get(unit.unitId);
        if (u && u.status === 'IDLE' && u.type === 'ENGINEER') {
          const cellData = clientState.visibleCells.get(u.cellId);
          if (cellData && cellData.ruin && cellData.ruinRevealed && cellData.ownerId === clientState.myPlayerId) {
            sendRestoreRuin(unit.unitId, u.cellId);
            clientState.pendingCommand = null;
            notifySelectionChanged();
          }
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

  setOnDirectMessage(cb: (playerId: string) => void): void {
    this.onDirectMessage = cb;
  }

  private countUnitsOnTile(tileId: string): number {
    let count = 0;
    for (const [, unit] of clientState.units) {
      if (unit.cellId === tileId) count++;
    }
    return count;
  }
}