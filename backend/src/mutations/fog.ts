import {
  FogVisibility,
  RuinType,
  ResourceType,
  CFG,
  type AdjacencyMap,
  type PlayerStateSlice,
  type VisibleCellData,
  type RevealedCellData,
  type UnitData,
  type CityData,
  type PlayerSummary,
  type RuinMarkerData,
  type BuildingData,
  type PlayerResourceData,
  type StockpileEntry,
  type ProductionItem,
  type ResourceInflowEntry,
  getFactoryRecipes,
} from '@vantaris/shared';
import { GameState } from '../state/GameState';
import { BuildingState } from '../state/BuildingState';
import { getCityStockpile } from './resources';
import { getBuildingStockpile, getCellBuildingCapacity, countBuildingsOnCell, getResourcesInvested } from './buildings';
import { getRepeatQueue, getPriorityQueue, getCurrentProduction } from './cities';

function getRecipeTicksTotal(building: BuildingState): number {
  if (!building.recipe) return 0;
  const recipe = getFactoryRecipes(CFG).find(r => r.id === building.recipe);
  if (!recipe) return 0;
  const specCycles = building.specializationCycles || 0;
  const multiplier = 1 + specCycles * CFG.FACTORY.SPECIALIZATION_BONUS_PER_CYCLE;
  return Math.ceil(recipe.ticksPerCycle / multiplier);
}

export function revealCellForPlayer(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  player.fog.setVisible(cellId);
}

export function snapshotAndHideCell(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  const cell = state.cells.get(cellId);
  if (!cell) return;
  const snapshot = JSON.stringify({
    ownerId: cell.ownerId || null,
    biome: cell.biome,
    ruin: cell.ruin || null,
  });
  player.fog.setRevealed(cellId, snapshot);
}

export function computeVisibilityForPlayer(
  state: GameState,
  playerId: string,
  adjacencyMap: AdjacencyMap,
  visionRange: number = CFG.UNITS.INFANTRY.visionRange,
): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const visibleCellIds = new Set<string>();

  for (const [cellId, cell] of state.cells) {
    if (cell.ownerId === playerId) {
      visibleCellIds.add(cellId);
      collectNeighborsInRange(cellId, visionRange, visibleCellIds, adjacencyMap);
    }
  }

  for (const [, unit] of state.units) {
    if (unit.ownerId === playerId) {
      visibleCellIds.add(unit.cellId);
      collectNeighborsInRange(unit.cellId, visionRange, visibleCellIds, adjacencyMap);
    }
  }

  const currentVisible = new Set<string>();
  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      currentVisible.add(cellId);
    }
  }

  for (const cellId of currentVisible) {
    if (!visibleCellIds.has(cellId)) {
      snapshotAndHideCell(state, playerId, cellId);
    }
  }

  for (const cellId of visibleCellIds) {
    if (!currentVisible.has(cellId)) {
      player.fog.setVisible(cellId);
    }
  }
}

function collectNeighborsInRange(
  startCellId: string,
  range: number,
  result: Set<string>,
  adjacencyMap: AdjacencyMap,
): void {
  const visited = new Set<string>([startCellId]);
  let frontier = new Set<string>([startCellId]);

  for (let i = 0; i < range; i++) {
    const nextFrontier = new Set<string>();
    for (const cellId of frontier) {
      const neighbors = adjacencyMap[cellId] ?? [];
      for (const nId of neighbors) {
        if (!visited.has(nId)) {
          visited.add(nId);
          result.add(nId);
          nextFrontier.add(nId);
        }
      }
    }
    frontier = nextFrontier;
  }
}

function stockpileMapToEntries(stockpile: Record<string, number>): StockpileEntry[] {
  const entries: StockpileEntry[] = [];
  for (const [resource, amount] of Object.entries(stockpile)) {
    if (amount > 0) entries.push({ resource, amount: Math.floor(amount * 100) / 100 });
  }
  return entries;
}

export function buildPlayerSlice(
  state: GameState,
  playerId: string,
): PlayerStateSlice {
  const player = state.players.get(playerId);
  if (!player) {
    return {
      myPlayerId: playerId,
      currentTick: state.tick,
      sunAngle: state.getSunAngle(),
      dayNightCycleTicks: state.dayNightCycleTicks,
      visibleCells: [],
      revealedCells: [],
      ruinMarkers: [],
      units: [],
      cities: [],
      buildings: [],
      players: [],
      resources: { food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0 },
    };
  }

  const visibleCells: VisibleCellData[] = [];
  const revealedCells: RevealedCellData[] = [];
  const visibleCellIds = new Set<string>();
  const revealedCellIds = new Set<string>();
  const ruinMarkers: RuinMarkerData[] = [];

  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      const cell = state.cells.get(cellId);
      if (cell) {
        const cellBuildings: BuildingData[] = [];
        for (const [, building] of state.buildings) {
          if (building.cellId === cell.cellId) {
            const bsp = getBuildingStockpile(building);
            cellBuildings.push({
              buildingId: building.buildingId,
              ownerId: building.ownerId,
              cellId: building.cellId,
              type: building.type,
              productionTicksRemaining: building.productionTicksRemaining,
              recipe: building.recipe,
              factoryTier: building.factoryTier,
              factoryXp: building.factoryXp,
              stockpile: stockpileMapToEntries(bsp),
              resourcesInvested: getResourcesInvested(building),
              deliveryTargetId: building.deliveryTargetId,
              specializationRecipe: building.specializationRecipe,
              specializationCycles: building.specializationCycles,
              recipeTicksRemaining: building.recipeTicksRemaining,
              recipeTicksTotal: getRecipeTicksTotal(building),
            });
          }
        }

        const capacity = getCellBuildingCapacity(cell);
        const currentCount = countBuildingsOnCell(state, cell.cellId);

        visibleCells.push({
          cellId: cell.cellId,
          biome: cell.biome,
          ownerId: cell.ownerId,
          elevation: cell.elevation,
          moisture: cell.moisture,
          temperature: cell.temperature,
          resourceYield: cell.resourceType !== ResourceType.NONE ? { primary: cell.resourceType as ResourceType, amount: cell.resourceAmount } : null,
          ruin: (cell.ruin as RuinType) || null,
          ruinRevealed: cell.ruinRevealed,
          buildings: cellBuildings,
          buildingCapacity: capacity,
        });
        visibleCellIds.add(cellId);
      }
    } else if (fogValue === FogVisibility.REVEALED) {
      const snapshot = player.fog.getSnapshot(cellId);
      if (snapshot) {
        const data = JSON.parse(snapshot);
        revealedCells.push({
          cellId,
          lastKnownBiome: data.biome || '',
          lastKnownOwnerId: data.ownerId || '',
          lastKnownRuin: data.ruin || null,
        });
        revealedCellIds.add(cellId);
      }
    }
  }

  for (const [, cell] of state.cells) {
    if (cell.ruin && revealedCellIds.has(cell.cellId) && !visibleCellIds.has(cell.cellId)) {
      ruinMarkers.push({ cellId: cell.cellId, ruin: cell.ruin as RuinType });
    }
  }

  const units: UnitData[] = [];
  for (const [, unit] of state.units) {
    if (visibleCellIds.has(unit.cellId)) {
      let path: string[] = [];
      try {
        path = JSON.parse(unit.path);
      } catch { /* ignore */ }

      units.push({
        unitId: unit.unitId,
        ownerId: unit.ownerId,
        type: unit.type,
        status: unit.status,
        cellId: unit.cellId,
        path,
        movementTicksRemaining: unit.movementTicksRemaining,
        movementTicksTotal: unit.movementTicksTotal,
        claimTicksRemaining: unit.claimTicksRemaining,
        buildTicksRemaining: unit.buildTicksRemaining,
        engineerLevel: unit.engineerLevel,
        buildExhaustion: unit.buildExhaustion,
      });
    }
  }

    const cities: CityData[] = [];
    for (const [, city] of state.cities) {
      if (visibleCellIds.has(city.cellId)) {
        const nextThreshold = city.tier < CFG.CITY.TIER_XP_THRESHOLDS.length
          ? CFG.CITY.TIER_XP_THRESHOLDS[city.tier]
          : CFG.CITY.TIER_XP_THRESHOLDS[CFG.CITY.TIER_XP_THRESHOLDS.length - 1];
        const citySp = getCityStockpile(city);
        const repeatQ = getRepeatQueue(city);
        const priorityQ = getPriorityQueue(city);
        const currentProd = getCurrentProduction(city);
        let productionResourcesInvested: Record<string, number> = {};
        try { productionResourcesInvested = JSON.parse(city.productionResourcesInvested); } catch {}
        let resourceInflows: ResourceInflowEntry[] = [];
        try { resourceInflows = JSON.parse(city.resourceInflows); } catch {}
        cities.push({
          cityId: city.cityId,
          ownerId: city.ownerId,
          cellId: city.cellId,
          name: city.name,
          tier: city.tier,
          xp: city.xp,
          xpToNext: nextThreshold,
          population: Math.floor(city.population),
          repeatQueue: repeatQ,
          priorityQueue: priorityQ,
          currentProduction: currentProd,
          productionTicksRemaining: city.productionTicksRemaining,
          productionTicksTotal: city.productionTicksTotal,
          productionResourcesInvested: productionResourcesInvested,
          foodPerTick: city.foodPerTick,
          energyPerTick: city.energyPerTick,
          stockpile: stockpileMapToEntries(citySp),
          resourceInflows: resourceInflows,
        });
      }
    }

  const buildings: BuildingData[] = [];
  for (const [, building] of state.buildings) {
    if (visibleCellIds.has(building.cellId)) {
      const bsp = getBuildingStockpile(building);
        buildings.push({
          buildingId: building.buildingId,
          ownerId: building.ownerId,
          cellId: building.cellId,
          type: building.type,
          productionTicksRemaining: building.productionTicksRemaining,
          recipe: building.recipe,
          factoryTier: building.factoryTier,
          factoryXp: building.factoryXp,
          stockpile: stockpileMapToEntries(bsp),
          resourcesInvested: getResourcesInvested(building),
          deliveryTargetId: building.deliveryTargetId,
          specializationRecipe: building.specializationRecipe,
          specializationCycles: building.specializationCycles,
          recipeTicksRemaining: building.recipeTicksRemaining,
          recipeTicksTotal: getRecipeTicksTotal(building),
        });
    }
  }

  const players: PlayerSummary[] = [];
  for (const [pid, ps] of state.players) {
    let unitCount = 0;
    for (const [, unit] of state.units) {
      if (unit.ownerId === pid) unitCount++;
    }
    let cityCount = 0;
    let totalPop = 0;
    for (const [, city] of state.cities) {
      if (city.ownerId === pid) {
        cityCount++;
        totalPop += Math.floor(city.population);
      }
    }
    let factoryCount = 0;
    for (const [, building] of state.buildings) {
      if (building.ownerId === pid && building.type === 'FACTORY' && building.productionTicksRemaining <= 0) factoryCount++;
    }
    players.push({
      playerId: ps.playerId,
      displayName: ps.displayName,
      color: ps.color,
      alive: ps.alive,
      territoryCount: ps.territoryCellCount,
      unitCount,
      cityCount,
      population: totalPop,
      factoryCount,
    });
  }

  let totalFood = 0;
  let totalEnergy = 0;
  let totalPop = 0;
  let factCount = 0;

  for (const [, city] of state.cities) {
    if (city.ownerId !== playerId) continue;
    totalPop += Math.floor(city.population);
    const sp = getCityStockpile(city);
    totalFood += (sp[ResourceType.BREAD] || 0) + (sp[ResourceType.GRAIN] || 0);
    totalEnergy += sp[ResourceType.POWER] || 0;
  }

  for (const [, building] of state.buildings) {
    if (building.ownerId === playerId && building.type === 'FACTORY' && building.productionTicksRemaining <= 0) {
      factCount++;
    }
  }

  const resources: PlayerResourceData = {
    food: Math.floor(totalFood),
    energy: Math.floor(totalEnergy),
    foodPerTick: 0,
    energyPerTick: 0,
    totalPopulation: totalPop,
    factoryCount: factCount,
  };

  return {
    myPlayerId: playerId,
    currentTick: state.tick,
    sunAngle: state.getSunAngle(),
    dayNightCycleTicks: state.dayNightCycleTicks,
    visibleCells,
    revealedCells,
    ruinMarkers,
    units,
    cities,
    buildings,
    players,
    resources,
  };
}