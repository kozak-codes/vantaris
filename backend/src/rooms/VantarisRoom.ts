import { Room, Client } from '@colyseus/core';
import { GameState } from '../state/GameState';
import { GamePhase, TerrainType, ResourceType, BuildingType, UnitType, UnitStatus, CFG, MATCHMAKING_CFG, getUnitBuildableTypes, getInfantryBuildableTypes, getCitizenBuildableTypes, getBuildingTicks, getBuildingCosts, getFactoryRecipes, getExtractorOutput, getUpgradeForType, AdjacencyMap, buildAdjacencyMap } from '@vantaris/shared';
import type { ProductionItem } from '@vantaris/shared';

const BUILDING_TICKS = getBuildingTicks(CFG);
const BUILDING_COSTS = getBuildingCosts(CFG);
import { generateGlobe } from '../globe';
import { computeVisibilityForPlayer, buildPlayerSlice } from '../mutations/fog';
import { completeClaim } from '../mutations/units';
import { createCity, tickCityProduction, addToRepeatQueue, removeFromRepeatQueue, addPriorityItem, clearPriorityQueue, getRepeatQueue, setRepeatQueue, canCityAffordProduction, consumeProductionCosts, investProductionTick } from '../mutations/cities';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { UnitState } from '../state/UnitState';
import { BuildingState } from '../state/BuildingState';
import { TickSystem } from '../systems/TickSystem';
import { findPath, buildUnitsByCellId } from '../systems/Pathfinding';
import { processCitizenAI, createTaskQueue } from '../systems/CitizenAI';
import { spawnUnit, assignPath, stepUnit, startClaiming } from '../mutations/units';
import type { StepResult } from '../mutations/units';
import { createBuilding, tickBuildingProduction, canPlaceBuilding, cancelBuilding, getAvailableBuildTypes, countBuildingsOnCell, canAffordBuildingCost, tickBuildingConstruction, getResourcesInvested } from '../mutations/buildings';
import { tickExtractorOutput, tickFactoryProcessing, tickCityResourceDrain, tickCityXP, tickInflowResets, tickBuildingWages, tickCitizenVitals } from '../mutations/resources';
import { claimCell, loseCell } from '../mutations/territory';

interface CreateOptions {
  spawnPoints: { cellId: string }[];
  dayNightCycleTicks?: number;
  worldSeed?: number;
}

function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export class VantarisRoom extends Room<GameState> {
  maxClients = 8;
  private adjacencyMap: AdjacencyMap = {};
  private cellPositions: Record<string, [number, number, number]> = {};
  private tickSystem = new TickSystem();
  private taskQueue = createTaskQueue();

  async onCreate(options: CreateOptions): Promise<void> {
    const playerCount = options.spawnPoints?.length || 1;
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    this.maxClients = MATCHMAKING_CFG.MAX_PLAYERS;
    const worldSeed = options.worldSeed ?? hashStringToSeed(this.roomId);
    const globe = generateGlobe(subdivideLevel, worldSeed);

    this.setState(new GameState());

    this.state.dayNightCycleTicks = options.dayNightCycleTicks || CFG.DAY_NIGHT.CYCLE_TICKS;

    const cellIds: string[] = [];
    for (const cell of globe.cells) {
      const cellState = new CellState();
      cellState.cellId = cell.id;
      cellState.biome = cell.biome;
      cellState.ownerId = '';
      cellState.hasCity = false;
      cellState.cityId = '';
      cellState.elevation = cell.elevation;
      cellState.moisture = cell.moisture;
      cellState.temperature = cell.temperature;
      cellState.plateId = cell.plateId;
      cellState.resourceType = cell.resourceType as ResourceType;
      cellState.resourceAmount = cell.resourceAmount;
      cellState.ruin = cell.ruin;
      cellState.ruinRevealed = cell.ruinRevealed;
      cellState.isPentagon = cell.isPentagon;
      this.state.cells.set(cell.id, cellState);
      cellIds.push(cell.id);
      this.cellPositions[cell.id] = cell.center;
    }

    const rawAdjacency = globe.adjacency;
    const adjacencyWithStringKeys: AdjacencyMap = {};
    for (const [cellId, neighbors] of rawAdjacency) {
      adjacencyWithStringKeys[cellId] = [...neighbors];
    }

    this.adjacencyMap = adjacencyWithStringKeys;

    const distanceAdjacency = buildAdjacencyMap(cellIds, this.cellPositions);
    for (const cellId of cellIds) {
      if (!this.adjacencyMap[cellId] || this.adjacencyMap[cellId].length === 0) {
        this.adjacencyMap[cellId] = distanceAdjacency[cellId] || [];
      }
    }

    this.state.phase = GamePhase.ACTIVE;

    this.tickSystem.start((tick) => this.onTick(tick));

    this.onMessage('moveUnit', (client, data: { unitId: string; targetCellId: string }) => {
      this.handleMoveUnit(client, data);
    });

    this.onMessage('setUnitIdle', (client, data: { unitId: string }) => {
      this.handleSetUnitIdle(client, data);
    });

    this.onMessage('cityQueueAddPriority', (client, data: { cityId: string; unitType: string }) => {
      this.handleCityQueueAddPriority(client, data);
    });

    this.onMessage('cityQueueAddRepeat', (client, data: { cityId: string; unitType: string }) => {
      this.handleCityQueueAddRepeat(client, data);
    });

    this.onMessage('cityQueueRemoveRepeat', (client, data: { cityId: string; index: number }) => {
      this.handleCityQueueRemoveRepeat(client, data);
    });

    this.onMessage('cityQueueClearPriority', (client, data: { cityId: string }) => {
      this.handleCityQueueClearPriority(client, data);
    });

    this.onMessage('cityToggleCitizenProduction', (client, data: { cityId: string }) => {
      this.handleCityToggleCitizenProduction(client, data);
    });

    this.onMessage('claimTerritory', (client, data: { unitId: string }) => {
      this.handleClaimTerritory(client, data);
    });

    this.onMessage('buildStructure', (client, data: { unitId: string; buildingType: string; cellId: string }) => {
      this.handleBuildStructure(client, data);
    });

    this.onMessage('setFactoryRecipe', (client, data: { buildingId: string; recipeId: string }) => {
      this.handleSetFactoryRecipe(client, data);
    });

    this.onMessage('upgradeUnit', (client, data: { unitId: string; targetUnitType: string }) => {
      this.handleUpgradeUnit(client, data);
    });

    this.onMessage('renameCity', (client, data: { cityId: string; name: string }) => {
      this.handleRenameCity(client, data);
    });

    this.onMessage('setStockpileTarget', (client, data: { buildingId: string; target: number }) => {
      this.handleSetStockpileTarget(client, data);
    });

    this.onMessage('setBuildingWage', (client, data: { buildingId: string; wage: number }) => {
      const playerId = client.sessionId;
      const building = this.state.buildings.get(data.buildingId);
      if (!building || building.ownerId !== playerId) return;
      building.wagePer100Ticks = Math.max(0, data.wage);
    });

    this.onMessage('revealRuin', (client, data: { cellId: string }) => {
      const cell = this.state.cells.get(data.cellId);
      if (cell && cell.ruin && !cell.ruinRevealed) {
        cell.ruinRevealed = true;
      }
    });

    this.onMessage('ping', (client) => {
      client.send('pong', { serverTick: this.state.tick });
    });

    this.onMessage('chatMessage', (client, data: { text: string }) => {
      this.handleChatMessage(client, data.text);
    });

    this.onMessage('chatDirect', (client, data: { targetId: string; text: string }) => {
      this.handleDirectMessage(client, data.targetId, data.text);
    });

    this.onMessage('availableBuildTypes', (client, data: { cellId: string }) => {
      const playerId = client.sessionId;
      const types = getAvailableBuildTypes(this.state, data.cellId, playerId);
      client.send('availableBuildTypesResult', { cellId: data.cellId, types });
    });

    this.onMessage('updateCamera', (client, data: { qx: number; qy: number; qz: number; qw: number; zoom: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.cameraQuatX = data.qx;
        player.cameraQuatY = data.qy;
        player.cameraQuatZ = data.qz;
        player.cameraQuatW = data.qw;
        player.cameraZoom = data.zoom;
      }
    });

    this.onMessage('setClaimCompensation', (client, data: { value: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.claimCompensation = Math.max(0, data.value);
      }
    });

    this.onMessage('setFoodCreditRate', (client, data: { value: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.foodCreditRate = Math.max(0, data.value);
      }
    });
  }

  onJoin(client: Client, options: { spawnPoint?: string; displayName?: string }): void {
    const playerId = client.sessionId;
    const player = new PlayerState();
    player.playerId = playerId;
    player.displayName = options?.displayName || `Player ${this.state.players.size + 1}`;
    player.color = CFG.PLAYER_COLORS[this.state.players.size % CFG.PLAYER_COLORS.length];
    player.territoryCellCount = 0;

    const spawnCellId = this.findAvailableSpawnCell();
    if (!spawnCellId) {
      console.error('[vantaris] No available spawn cell for player', playerId);
      return;
    }

    this.state.players.set(playerId, player);

    const city = createCity(this.state, playerId, spawnCellId);
    city.homesAvailable = CFG.CITY.HOMES_PER_CITY;

    player.energyCredits = 0;
    player.claimCompensation = 10;

    completeClaim(this.state, spawnCellId, playerId);

    setRepeatQueue(city, []);

    for (let i = 0; i < CFG.CITY.STARTING_CITIZENS; i++) {
      spawnUnit(this.state, playerId, spawnCellId, 'CITIZEN', 1, city.cityId);
    }

      computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, CFG.UNITS.CITIZEN.visionRange);

    const slice = buildPlayerSlice(this.state, playerId);
    client.send('stateUpdate', slice);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (consented) return;
    try {
      await this.allowReconnection(client, MATCHMAKING_CFG.RECONNECTION_WINDOW_MS);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        computeVisibilityForPlayer(this.state, client.sessionId, this.adjacencyMap, CFG.UNITS.INFANTRY.visionRange);
        const slice = buildPlayerSlice(this.state, client.sessionId);
        client.send('stateUpdate', slice);
      }
    } catch {
      // reconnection timeout
    }
  }

  onDispose(): void {
    this.tickSystem.stop();
  }

  private onTick(tick: number): void {
    this.processBuildTimers();
    this.processCityProduction();
    this.processUnitMovement();
    this.processClaimTimers();
    this.processCitizenAI();
    this.processExtractorOutput();
    this.processFactoryProcessing();
    this.processBuildingWages();
    this.processCitizenVitals();
    this.processCityResourceDrain();
    this.processCityXP();
    this.processInflowResets();
    this.checkElimination();
    this.broadcastPlayerSlices();
    this.state.tick = tick;
  }

  private processBuildTimers(): void {
    const consumedBuilders: string[] = [];

    for (const [, unit] of this.state.units) {
      if (unit.status === 'BUILDING') {
        const unitConfig = CFG.UNITS[unit.type];
        const exhaustionBudget = unitConfig?.buildExhaustion ?? 1;

        unit.buildTicksRemaining--;
        if (unit.buildTicksRemaining <= 0) {
          if (unit.buildExhaustion >= exhaustionBudget) {
            consumedBuilders.push(unit.unitId);
          } else {
            unit.status = 'IDLE';
            unit.buildTicksRemaining = 0;
          }
        }
      }
    }

    for (const unitId of consumedBuilders) {
      this.state.units.delete(unitId);
    }

    for (const [, building] of this.state.buildings) {
      if (building.productionTicksRemaining > 0) {
        tickBuildingConstruction(this.state, building, this.adjacencyMap);
      }
    }
  }

  private processCityProduction(): void {
    for (const [, city] of this.state.cities) {
      if (!canCityAffordProduction(city)) continue;

      investProductionTick(city);

      const completed = tickCityProduction(city);
      if (completed) {
        const unitsOnCell = this.countUnitsOnCell(city.cellId);
        if (unitsOnCell < CFG.MAX_PER_HEX) {
          consumeProductionCosts(city, completed);
          spawnUnit(this.state, city.ownerId, city.cellId, completed.type, 1, city.cityId);
        }
      }
    }
  }

  private processUnitMovement(): void {
    for (const [, unit] of this.state.units) {
      if (unit.status === 'MOVING' || unit.status === 'RETURNING') {
        const result = stepUnit(this.state, unit.unitId, this.adjacencyMap);
        if (result && result.arrived) {
          const cell = this.state.cells.get(result.cellId);
          if (cell && cell.ruin && !cell.ruinRevealed) {
            cell.ruinRevealed = true;
          }
          if (unit.status === 'RETURNING') {
            const homeCity = this.state.cities.get(unit.homeCityId);
            if (homeCity && unit.cellId === homeCity.cellId) {
              unit.path = '[]';
              unit.movementTicksRemaining = 0;
              unit.movementTicksTotal = 0;
            }
          }
        }
      }
    }
  }

  private processClaimTimers(): void {
    const completedClaims: { unitId: string; cellId: string; ownerId: string }[] = [];

    for (const [, unit] of this.state.units) {
      if (unit.status === 'CLAIMING') {
        unit.claimTicksRemaining--;
        if (unit.claimTicksRemaining <= 0) {
          completedClaims.push({
            unitId: unit.unitId,
            cellId: unit.cellId,
            ownerId: unit.ownerId,
          });
        }
      }
    }

    for (const claim of completedClaims) {
      const unit = this.state.units.get(claim.unitId);
      if (unit) {
        unit.status = 'IDLE';
        unit.claimTicksRemaining = 0;
      }
      completeClaim(this.state, claim.cellId, claim.ownerId);

      const owner = this.state.players.get(claim.ownerId);
      if (owner) {
        const compensation = owner.claimCompensation;
        if (compensation > 0 && owner.energyCredits >= compensation && unit) {
          owner.energyCredits -= compensation;
          unit.energyCredits += compensation;
        }
        computeVisibilityForPlayer(this.state, claim.ownerId, this.adjacencyMap, CFG.UNITS[unit?.type ?? 'CITIZEN']?.visionRange ?? 1);
      }
    }
  }

  private processCitizenAI(): void {
    processCitizenAI(this.state, this.adjacencyMap, this.cellPositions, this.state.tick, this.taskQueue);
  }

  private processExtractorOutput(): void {
    tickExtractorOutput(this.state, this.cellPositions);
  }

  private processFactoryProcessing(): void {
    tickFactoryProcessing(this.state);
  }

  private processBuildingWages(): void {
    tickBuildingWages(this.state, this.state.tick);
  }

  private processCitizenVitals(): void {
    tickCitizenVitals(this.state, this.cellPositions);
  }

  private processCityResourceDrain(): void {
    tickCityResourceDrain(this.state);
  }

  private processCityXP(): void {
    tickCityXP(this.state);
  }

  private processInflowResets(): void {
    tickInflowResets(this.state);
  }

  private broadcastPlayerSlices(): void {
    for (const client of this.clients) {
      const playerId = client.sessionId;
computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, CFG.UNITS.INFANTRY.visionRange);
      const slice = buildPlayerSlice(this.state, playerId);
      client.send('stateUpdate', slice);
    }
  }

  private handleSetFactoryRecipe(client: Client, data: { buildingId: string; recipeId: string }): void {
    const playerId = client.sessionId;
    const building = this.state.buildings.get(data.buildingId);
    if (!building || building.ownerId !== playerId || building.type !== 'FACTORY') return;

    if (data.recipeId === '') {
      building.recipe = '';
      building.recipeTicksRemaining = 0;
      building.specializationRecipe = '';
      building.specializationCycles = 0;
      return;
    }

    const recipe = getFactoryRecipes(CFG).find(r => r.id === data.recipeId);
    if (!recipe) return;
    if (building.factoryTier < recipe.minFactoryTier) return;

    if (building.recipe !== data.recipeId) {
      building.recipeTicksRemaining = 0;
      building.specializationRecipe = '';
      building.specializationCycles = 0;
    }
    building.recipe = data.recipeId;
  }

  private handleRenameCity(client: Client, data: { cityId: string; name: string }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;

    const trimmed = data.name.trim().slice(0, 24);
    if (trimmed.length === 0) return;

    city.name = trimmed;
  }

  private handleSetStockpileTarget(client: Client, data: { buildingId: string; target: number }): void {
    const playerId = client.sessionId;
    const building = this.state.buildings.get(data.buildingId);
    if (!building || building.ownerId !== playerId) return;
    building.stockpileTarget = Math.max(0, data.target);
  }

  private handleMoveUnit(client: Client, data: { unitId: string; targetCellId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    const targetCell = this.state.cells.get(data.targetCellId);
    if (!targetCell || targetCell.biome === TerrainType.OCEAN) {
      client.send('error', { type: 'error', code: 'NO_PATH' });
      return;
    }

    const unitsByCellId = buildUnitsByCellId(this.state.units);

    const path = findPath(
      unit.cellId,
      data.targetCellId,
      this.state.cells,
      this.adjacencyMap,
      unitsByCellId,
      CFG.MAX_PER_HEX,
      this.cellPositions,
    );

    if (!path) {
      client.send('error', { type: 'error', code: 'NO_PATH' });
      return;
    }

    assignPath(this.state, unit.unitId, path);
  }

  private handleSetUnitIdle(client: Client, data: { unitId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    if (unit.status === 'BUILDING') {
      for (const [, building] of this.state.buildings) {
        if (building.cellId === unit.cellId && building.ownerId === playerId && building.productionTicksRemaining > 0) {
          cancelBuilding(this.state, building.buildingId, this.adjacencyMap);
          break;
        }
      }
    }

    unit.status = 'IDLE';
    unit.path = '[]';
    unit.movementTicksRemaining = 0;
    unit.claimTicksRemaining = 0;
    unit.buildTicksRemaining = 0;
  }

  private handleCityQueueAddPriority(client: Client, data: { cityId: string; unitType: string }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;
    addPriorityItem(city, data.unitType);
  }

  private handleCityQueueAddRepeat(client: Client, data: { cityId: string; unitType: string }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;
    addToRepeatQueue(city, data.unitType);
  }

  private handleCityQueueRemoveRepeat(client: Client, data: { cityId: string; index: number }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;
    removeFromRepeatQueue(city, data.index);
  }

  private handleCityQueueClearPriority(client: Client, data: { cityId: string }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;
    clearPriorityQueue(city);
  }

  private handleCityToggleCitizenProduction(client: Client, data: { cityId: string }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;
    const repeatQ = getRepeatQueue(city);
    const hasCitizen = repeatQ.includes('CITIZEN');
    if (hasCitizen) {
      const filtered = repeatQ.filter((t: string) => t !== 'CITIZEN');
      setRepeatQueue(city, filtered);
    } else {
      repeatQ.push('CITIZEN');
      setRepeatQueue(city, repeatQ);
    }
  }

  private handleClaimTerritory(client: Client, data: { unitId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId || !CFG.UNITS[unit.type]?.canClaim || unit.status !== 'IDLE') return;

    const cell = this.state.cells.get(unit.cellId);
    if (!cell) return;
    if (cell.ownerId === playerId) return;

    if (!this.isAdjacentToTerritory(unit.cellId, playerId)) return;

    startClaiming(this.state, data.unitId);
  }

  private handleBuildStructure(client: Client, data: { unitId: string; buildingType: string; cellId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId || unit.status !== 'IDLE') return;

    const buildingConfig = CFG.BUILDINGS[data.buildingType];
    if (!buildingConfig) return;

    const unitConfig = CFG.UNITS[unit.type];
    if (!unitConfig) return;
    const exhaustionBudget = unitConfig.buildExhaustion;
    const exhaustionCost = buildingConfig.exhaustionCost;
    if (unit.buildExhaustion + exhaustionCost > exhaustionBudget) {
      client.send('error', { type: 'error', code: 'INSUFFICIENT_EXHAUSTION' });
      return;
    }

    const unitLevel = unit.type === 'ENGINEER' ? unit.engineerLevel : 1;
    const allowedBuilders = getUnitBuildableTypes(CFG, unit.type, unitLevel);
    if (!allowedBuilders.includes(data.buildingType)) return;

    const cell = this.state.cells.get(data.cellId);
    if (!cell) return;

    if (unit.cellId !== data.cellId) return;

    const engineerLevel = unit.type === 'ENGINEER' ? unit.engineerLevel : 1;
    if (!canPlaceBuilding(this.state, data.cellId, data.buildingType, playerId, engineerLevel, unit.type)) {
      client.send('error', { type: 'error', code: 'INVALID_BUILD' });
      return;
    }

    if (!canAffordBuildingCost(this.state, data.cellId, data.buildingType, playerId, this.adjacencyMap)) {
      client.send('error', { type: 'error', code: 'INSUFFICIENT_RESOURCES' });
      return;
    }

    const building = createBuilding(this.state, playerId, data.cellId, data.buildingType);
    if (!building) {
      client.send('error', { type: 'error', code: 'INVALID_BUILD' });
      return;
    }

    unit.buildExhaustion += exhaustionCost;

    const buildTicks = BUILDING_TICKS[data.buildingType] ?? 200;

    if (data.buildingType === 'CITY') {
      this.state.buildings.delete(building.buildingId);
      const city = createCity(this.state, playerId, data.cellId);
    }

    unit.status = 'BUILDING';
    unit.buildTicksRemaining = buildTicks;
  }

  private handleUpgradeUnit(client: Client, data: { unitId: string; targetUnitType: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId || unit.status !== 'IDLE') return;

    const targetConfig = CFG.UNITS[data.targetUnitType];
    if (!targetConfig || !targetConfig.upgradeFrom) return;

    if (unit.type !== targetConfig.upgradeFrom) {
      client.send('error', { type: 'error', code: 'INVALID_UPGRADE' });
      return;
    }

    let onCityTile = false;
    for (const [, city] of this.state.cities) {
      if (city.cellId === unit.cellId && city.ownerId === playerId) {
        onCityTile = true;
        break;
      }
    }
    if (!onCityTile) {
      client.send('error', { type: 'error', code: 'MUST_BE_ON_CITY' });
      return;
    }

    const upgradeCost = targetConfig.upgradeCost;
    if (!upgradeCost) return;

    let nearestCity: any = null;
    for (const [, city] of this.state.cities) {
      if (city.cellId === unit.cellId && city.ownerId === playerId) {
        nearestCity = city;
        break;
      }
    }
    if (!nearestCity) return;

    const stockpile = nearestCity.stockpile as Map<string, number>;
    for (const [resource, amount] of Object.entries(upgradeCost)) {
      const available = stockpile.get(resource) ?? 0;
      if (available < amount) {
        client.send('error', { type: 'error', code: 'INSUFFICIENT_RESOURCES' });
        return;
      }
    }

    for (const [resource, amount] of Object.entries(upgradeCost)) {
      const current = stockpile.get(resource) ?? 0;
      const remaining = current - amount;
      if (remaining <= 0) {
        stockpile.delete(resource);
      } else {
        stockpile.set(resource, remaining);
      }
    }

    unit.type = data.targetUnitType;
    if (data.targetUnitType === 'INFANTRY') {
      unit.type = 'INFANTRY';
    } else if (data.targetUnitType === 'ENGINEER') {
      unit.type = 'ENGINEER';
      unit.engineerLevel = 1;
    } else if (data.targetUnitType === 'TRADER') {
      unit.type = 'TRADER';
    }
  }

  private isAdjacentToTerritory(cellId: string, playerId: string): boolean {
    const neighbors = this.adjacencyMap[cellId] ?? [];
    for (const nId of neighbors) {
      const nCell = this.state.cells.get(nId);
      if (nCell && nCell.ownerId === playerId) return true;
    }
    return false;
  }

  private findAvailableSpawnCell(): string | null {
    const terrainPriority = [TerrainType.PLAINS, TerrainType.DESERT, TerrainType.TUNDRA];

    for (const terrain of terrainPriority) {
      for (const [cellId, cell] of this.state.cells) {
        if (cell.biome !== terrain) continue;
        if (cell.ownerId !== '') continue;

        const neighbors = this.adjacencyMap[cellId] ?? [];
        let adjacentToOtherPlayer = false;
        for (const nId of neighbors) {
          const nCell = this.state.cells.get(nId);
          if (nCell && nCell.ownerId !== '') {
            adjacentToOtherPlayer = true;
            break;
          }
        }

        if (adjacentToOtherPlayer) continue;

        let bufferOk = true;
        for (const nId of neighbors) {
          const nNeighbors = this.adjacencyMap[nId] ?? [];
          for (const nnId of nNeighbors) {
            const nnCell = this.state.cells.get(nnId);
            if (nnCell && nnCell.ownerId !== '') {
              bufferOk = false;
              break;
            }
          }
          if (!bufferOk) break;
        }

        if (bufferOk) return cellId;
      }
    }

    return null;
  }

  private countUnitsOnCell(cellId: string): number {
    let count = 0;
    for (const [, unit] of this.state.units) {
      if (unit.cellId === cellId) count++;
    }
    return count;
  }

  private checkElimination(): void {
    for (const [playerId, player] of this.state.players) {
      if (!player.alive) continue;

      let hasCity = false;
      for (const [, city] of this.state.cities) {
        if (city.ownerId === playerId) { hasCity = true; break; }
      }

      if (!hasCity) {
        player.alive = false;
        player.eliminatedTick = this.state.tick + 1;

        const unitsToRemove: string[] = [];
        for (const [unitId, unit] of this.state.units) {
          if (unit.ownerId === playerId) unitsToRemove.push(unitId);
        }
        for (const unitId of unitsToRemove) {
          this.state.units.delete(unitId);
        }

        for (const client of this.clients) {
          client.send('playerEliminated', {
            playerId,
            displayName: player.displayName,
            color: player.color,
            eliminatedTick: player.eliminatedTick,
          });
        }
      }
    }

    const alivePlayers: string[] = [];
    for (const [pid, ps] of this.state.players) {
      if (ps.alive) alivePlayers.push(pid);
    }
    if (alivePlayers.length === 1 && this.state.players.size > 1) {
      const winner = this.state.players.get(alivePlayers[0]);
      if (winner && this.state.phase !== GamePhase.FINISHED) {
        this.state.phase = GamePhase.FINISHED;
        for (const client of this.clients) {
          client.send('gameWon', {
            playerId: alivePlayers[0],
            displayName: winner.displayName,
            color: winner.color,
          });
        }
      }
    }
  }

  private handleChatMessage(client: Client, text: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    const trimmed = (text || '').slice(0, 200).trim();
    if (!trimmed) return;

    const msg = {
      id: `chat_${this.state.tick}_${client.sessionId}`,
      senderId: client.sessionId,
      senderName: player.displayName,
      senderColor: player.color,
      text: trimmed,
      timestamp: Date.now(),
      targetId: null as string | null,
    };

    for (const c of this.clients) {
      c.send('chatMessage', msg);
    }
  }

  private handleDirectMessage(client: Client, targetId: string, text: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    const trimmed = (text || '').slice(0, 200).trim();
    if (!trimmed) return;

    const msg = {
      id: `dm_${this.state.tick}_${client.sessionId}`,
      senderId: client.sessionId,
      senderName: player.displayName,
      senderColor: player.color,
      text: trimmed,
      timestamp: Date.now(),
      targetId,
    };

    client.send('chatMessage', msg);

    for (const c of this.clients) {
      if (c.sessionId === targetId) {
        c.send('chatMessage', msg);
        break;
      }
    }
  }

}