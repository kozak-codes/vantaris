import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { BuildingState } from '../state/BuildingState';
import { ResourceType, CFG, getExtractorOutput, getRawResources, getFactoryRecipes } from '@vantaris/shared';
import { getBuildingStockpile, setBuildingStockpile, getBuildingStockpileAmount, addToBuildingStockpile } from './buildings';
import type { AdjacencyMap, ResourceInflowEntry } from '@vantaris/shared';

const EXTRACTOR_OUTPUT = getExtractorOutput(CFG);
const RAW_RESOURCES = getRawResources(CFG);

const ROUND_PRECISION = 0.001;

function roundValue(v: number): number {
  return Math.round(v / ROUND_PRECISION) * ROUND_PRECISION;
}

function roundDisplay(v: number): number {
  return Math.round(v * 10) / 10;
}

function hexDist(fromCellId: string, toCellId: string, state: GameState, adjacencyMap: AdjacencyMap, ownerId: string): number {
  if (fromCellId === toCellId) return 0;
  const visited = new Set<string>([fromCellId]);
  let frontier = [fromCellId];
  for (let dist = 1; dist <= CFG.SUPPLY_CHAIN.MAX_HOPS + 2; dist++) {
    const nextFrontier: string[] = [];
    for (const cid of frontier) {
      const neighbors = adjacencyMap[cid] ?? [];
      for (const nId of neighbors) {
        if (visited.has(nId)) continue;
        if (nId === toCellId) return dist;
        const nCell = state.cells.get(nId);
        if (!nCell || nCell.ownerId !== ownerId) continue;
        visited.add(nId);
        nextFrontier.push(nId);
      }
    }
    frontier = nextFrontier;
  }
  return -1;
}

export function getCityStockpile(city: CityState): Record<string, number> {
  try {
    return JSON.parse(city.stockpile);
  } catch {
    return {};
  }
}

export function setCityStockpile(city: CityState, stockpile: Record<string, number>): void {
  const filtered: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockpile)) {
    const rv = roundValue(v);
    if (rv !== 0) filtered[k] = rv;
  }
  city.stockpile = JSON.stringify(filtered);
}

export function getCityStockpileAmount(city: CityState, resource: string): number {
  return getCityStockpile(city)[resource] || 0;
}

export function addToCityStockpile(city: CityState, resource: string, amount: number, source?: string): void {
  const sp = getCityStockpile(city);
  sp[resource] = (sp[resource] || 0) + amount;
  setCityStockpile(city, sp);
  addCityInflow(city, resource, amount, source);
}

export function consumeFromCityStockpile(city: CityState, resource: string, amount: number): boolean {
  const sp = getCityStockpile(city);
  const current = sp[resource] || 0;
  if (current < amount) return false;
  sp[resource] = current - amount;
  setCityStockpile(city, sp);
  return true;
}

export function initCityStockpile(city: CityState): void {
  const sp: Record<string, number> = {};
  for (const [k, v] of Object.entries(CFG.CITY.INITIAL_STOCKPILE)) {
    sp[k] = v;
  }
  setCityStockpile(city, sp);
}

function getCityInflows(city: CityState): ResourceInflowEntry[] {
  try {
    return JSON.parse(city.resourceInflows);
  } catch {
    return [];
  }
}

function setCityInflows(city: CityState, inflows: ResourceInflowEntry[]): void {
  city.resourceInflows = JSON.stringify(inflows);
}

function addCityInflow(city: CityState, resource: string, amount: number, source?: string): void {
  if (!source) return;
  const inflows = getCityInflows(city);
  const existing = inflows.find(i => i.resource === resource && i.source === source);
  if (existing) {
    existing.amount = roundDisplay(existing.amount + amount);
  } else {
    inflows.push({ resource, amount: roundDisplay(amount), source });
  }
  setCityInflows(city, inflows);
}

export function resetCityInflows(city: CityState): void {
  setCityInflows(city, []);
}

function findNearestStorage(
  cellId: string,
  ownerId: string,
  state: GameState,
  adjacencyMap: AdjacencyMap,
  preferredTargetId?: string,
): { type: 'city' | 'factory'; id: string; distance: number } | null {
  // If the building has a delivery target set, check it first
  if (preferredTargetId) {
    const targetCity = state.cities.get(preferredTargetId);
    if (targetCity && targetCity.ownerId === ownerId) {
      const dist = hexDist(cellId, targetCity.cellId, state, adjacencyMap, ownerId);
      if (dist >= 0 && dist <= CFG.SUPPLY_CHAIN.MAX_HOPS) {
        return { type: 'city', id: targetCity.cityId, distance: dist };
      }
    }
    const targetBuilding = state.buildings.get(preferredTargetId);
    if (targetBuilding && targetBuilding.ownerId === ownerId && targetBuilding.type === 'FACTORY' && targetBuilding.productionTicksRemaining <= 0) {
      const dist = hexDist(cellId, targetBuilding.cellId, state, adjacencyMap, ownerId);
      if (dist >= 0 && dist <= CFG.SUPPLY_CHAIN.MAX_HOPS) {
        return { type: 'factory', id: targetBuilding.buildingId, distance: dist };
      }
    }
  }

  const visited = new Set<string>([cellId]);
  let frontier = [cellId];

  for (let dist = 0; dist <= CFG.SUPPLY_CHAIN.MAX_HOPS; dist++) {
    const nextFrontier: string[] = [];

    for (const cid of frontier) {
      if (cid !== cellId) {
        const cell = state.cells.get(cid);
        if (!cell || cell.ownerId !== ownerId) continue;

        if (cell.hasCity) {
          const city = state.cities.get(cell.cityId);
          if (city && city.ownerId === ownerId) {
            return { type: 'city', id: city.cityId, distance: dist };
          }
        }

        for (const [, building] of state.buildings) {
          if (building.cellId === cid && building.ownerId === ownerId && building.type === 'FACTORY' && building.productionTicksRemaining <= 0) {
            return { type: 'factory', id: building.buildingId, distance: dist };
          }
        }
      }

      const neighbors = adjacencyMap[cid] ?? [];
      for (const nId of neighbors) {
        if (visited.has(nId)) continue;
        const nCell = state.cells.get(nId);
        if (!nCell || nCell.ownerId !== ownerId) continue;
        visited.add(nId);
        nextFrontier.push(nId);
      }
    }

    frontier = nextFrontier;
  }

  return null;
}

export function tickExtractorOutput(state: GameState, adjacencyMap: AdjacencyMap): void {
  for (const [, building] of state.buildings) {
    if (building.productionTicksRemaining > 0) continue;

    const output = EXTRACTOR_OUTPUT[building.type];
    if (!output) continue;

    const cell = state.cells.get(building.cellId);
    if (!cell) continue;

    const target = findNearestStorage(building.cellId, building.ownerId, state, adjacencyMap, building.deliveryTargetId || undefined);
    if (!target) continue;

    const penalty = 1.0 - (target.distance * CFG.SUPPLY_CHAIN.DISTANCE_PENALTY);
    const delivered = Math.max(0.01, output.amount * Math.max(0.1, penalty));

    if (target.type === 'city') {
      const city = state.cities.get(target.id);
      if (city) addToCityStockpile(city, output.resource, delivered, building.type);
    } else {
      const factory = state.buildings.get(target.id);
      if (factory) addToBuildingStockpile(factory, output.resource, delivered);
    }
  }
}

export function tickFactoryProcessing(state: GameState): void {
  for (const [, building] of state.buildings) {
    if (building.type !== 'FACTORY') continue;
    if (building.productionTicksRemaining > 0) continue;
    if (!building.recipe) continue;

    const recipe = getFactoryRecipes(CFG).find(r => r.id === building.recipe);
    if (!recipe) continue;
    if (building.factoryTier < recipe.minFactoryTier) continue;

    const canAfford = recipe.input.every((inp: { resource: ResourceType; amount: number }) => getBuildingStockpileAmount(building, inp.resource) >= inp.amount);
    if (!canAfford) continue;

    for (const inp of recipe.input) {
      const sp = getBuildingStockpile(building);
      sp[inp.resource] = (sp[inp.resource] || 0) - inp.amount;
      setBuildingStockpile(building, sp);
    }

    if (!building.recipeTicksRemaining) {
      if (building.specializationRecipe !== building.recipe) {
        building.specializationRecipe = building.recipe;
        building.specializationCycles = 0;
      }
      const specializationMultiplier = 1 + building.specializationCycles * CFG.FACTORY.SPECIALIZATION_BONUS_PER_CYCLE;
      const effectiveTicks = Math.ceil(recipe.ticksPerCycle / specializationMultiplier);
      building.recipeTicksRemaining = effectiveTicks;
    }
    building.recipeTicksRemaining--;

    if (building.recipeTicksRemaining <= 0) {
      for (const out of recipe.output) {
        addToBuildingStockpile(building, out.resource, out.amount);
      }
      building.factoryXp += CFG.FACTORY.XP_PER_CYCLE;
      building.specializationCycles++;
      building.recipeTicksRemaining = 0;

      for (let i = CFG.FACTORY.TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (building.factoryXp >= CFG.FACTORY.TIER_THRESHOLDS[i] && i + 1 > building.factoryTier) {
          building.factoryTier = i + 1;
          break;
        }
      }
    }
  }
}

export function tickFactoryOutputToCities(state: GameState, adjacencyMap: AdjacencyMap): void {
  for (const [, building] of state.buildings) {
    if (building.type !== 'FACTORY') continue;
    if (building.productionTicksRemaining > 0) continue;

    const sp = getBuildingStockpile(building);
    const processedKeys = Object.keys(sp).filter(k =>
      (Object.values(ResourceType) as string[]).includes(k) &&
      !RAW_RESOURCES.includes(k as ResourceType)
    );

    for (const res of processedKeys) {
      const amount = sp[res];
      if (amount <= 0) continue;

    const target = findNearestStorage(building.cellId, building.ownerId, state, adjacencyMap, building.deliveryTargetId || undefined);
      if (!target || target.type !== 'city') continue;

      const city = state.cities.get(target.id);
      if (!city) continue;

      const penalty = Math.max(0.1, 1.0 - (target.distance * CFG.SUPPLY_CHAIN.DISTANCE_PENALTY));
      const delivered = amount * penalty;

      const newSp = getBuildingStockpile(building);
      newSp[res] = 0;
      setBuildingStockpile(building, newSp);

      addToCityStockpile(city, res, delivered, 'FACTORY');
    }
  }
}

export function tickCityResourceDrain(state: GameState): void {
  for (const [, city] of state.cities) {
    const sp = getCityStockpile(city);
    sp[ResourceType.GRAIN] = (sp[ResourceType.GRAIN] || 0) + CFG.CITY.BASE_GRAIN_RATE;
    addCityInflow(city, ResourceType.GRAIN, CFG.CITY.BASE_GRAIN_RATE, 'BASE');

    sp[ResourceType.POWER] = (sp[ResourceType.POWER] || 0) + CFG.CITY.BASE_POWER_RATE;
    addCityInflow(city, ResourceType.POWER, CFG.CITY.BASE_POWER_RATE, 'BASE');

    const pop = city.population;
    if (pop <= 0) {
      setCityStockpile(city, sp);
      city.foodPerTick = 0;
      city.energyPerTick = 1;
      continue;
    }

    const breadDrain = pop * CFG.CITY.FOOD_DRAIN_PER_POP;
    const powerDrain = CFG.CITY.POWER_DRAIN_BASE + (city.tier - 1) * 0.3 + pop * CFG.CITY.ENERGY_DRAIN_PER_POP;

    const breadAvailable = sp[ResourceType.BREAD] || 0;

    let breadConsumed = Math.min(breadAvailable, breadDrain);
    if (breadConsumed < breadDrain) {
      const grainAvailable = sp[ResourceType.GRAIN] || 0;
      const grainNeeded = (breadDrain - breadConsumed) * CFG.CITY.BREAD_EMERGENCY_GRAIN_RATIO;
      const grainConsumed = Math.min(grainAvailable, grainNeeded);
      breadConsumed += grainConsumed / CFG.CITY.BREAD_EMERGENCY_GRAIN_RATIO;
      sp[ResourceType.GRAIN] = Math.max(0, (sp[ResourceType.GRAIN] || 0) - grainConsumed);
    }
    sp[ResourceType.BREAD] = Math.max(0, (sp[ResourceType.BREAD] || 0) - breadConsumed);

    const powerAvailable = sp[ResourceType.POWER] || 0;
    const powerConsumed = Math.min(powerAvailable, powerDrain);
    sp[ResourceType.POWER] = Math.max(0, (sp[ResourceType.POWER] || 0) - powerConsumed);

    const foodSatisfaction = breadDrain > 0 ? breadConsumed / breadDrain : 0;
    city.foodPerTick = roundDisplay(foodSatisfaction);
    city.energyPerTick = powerDrain > 0 ? roundDisplay(powerConsumed / powerDrain) : 1;

    setCityStockpile(city, sp);
  }
}

export function tickPopulation(state: GameState): void {
  for (const [, city] of state.cities) {
    const foodSatisfaction = city.foodPerTick;
    const popCap = getPopulationCap(city.tier);

    if (foodSatisfaction >= 1.0 && city.population < popCap) {
      const capacityRatio = city.population / popCap;
      const growthFactor = (1 - capacityRatio) * (foodSatisfaction - 1);
      const growth = CFG.CITY.POPULATION_GROWTH_RATE * city.population * growthFactor;
      city.population = Math.min(popCap, city.population + Math.max(0, growth));
    } else if (foodSatisfaction < CFG.CITY.POPULATION_DECLINE_THRESHOLD && city.population > 0) {
      if (foodSatisfaction <= CFG.CITY.POPULATION_STARVATION_THRESHOLD) {
        city.population = Math.max(0, city.population - CFG.CITY.POPULATION_STARVATION_RATE * city.population);
      } else {
        city.population = Math.max(0, city.population - CFG.CITY.POPULATION_DECLINE_RATE * city.population);
      }
    }

    if (city.population >= popCap) {
      city.population = Math.floor(popCap);
    }

    if (city.population < 1) {
      city.population = 0;
    }
  }
}

export function tickCityXP(state: GameState): void {
  for (const [, city] of state.cities) {
    const baseXP = Math.floor(city.population / 10) * CFG.CITY.XP_PER_POP_PER_10;
    let xp = baseXP;

    if (city.foodPerTick >= 1.0) xp = Math.floor(xp * CFG.CITY.XP_FOOD_MULTIPLIER);
    if (city.energyPerTick >= 1.0) xp = Math.floor(xp * CFG.CITY.XP_ENERGY_MULTIPLIER);

    city.xp += xp;

    for (let i = CFG.CITY.TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (city.xp >= CFG.CITY.TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
        city.tier = i + 1;
        break;
      }
    }
  }
}

function getPopulationCap(tier: number): number {
  return CFG.CITY.POPULATION_CAP[tier] ?? 50;
}

export function tickInflowResets(state: GameState): void {
  for (const [, city] of state.cities) {
    if (state.tick - city.lastInflowResetTick >= CFG.CITY.INFLOW_WINDOW_TICKS) {
      const inflows = getCityInflows(city);
      for (const entry of inflows) {
        entry.amount = Math.round(entry.amount / CFG.CITY.INFLOW_WINDOW_TICKS * 10) / 10;
      }
      setCityInflows(city, inflows);
      city.lastInflowResetTick = state.tick;
    }
  }
}

export function computePlayerResourceSummary(state: GameState, playerId: string): {
  food: number; energy: number;
  foodPerTick: number; energyPerTick: number;
  totalPopulation: number; factoryCount: number;
} {
  let totalPopulation = 0;
  let factoryCount = 0;
  let totalFood = 0;
  let totalEnergy = 0;
  let totalFoodSatisfaction = 0;
  let totalEnergySatisfaction = 0;
  let cityCount = 0;

  for (const [, city] of state.cities) {
    if (city.ownerId !== playerId) continue;
    totalPopulation += Math.floor(city.population);
    const sp = getCityStockpile(city);
    totalFood += (sp[ResourceType.BREAD] || 0) + (sp[ResourceType.GRAIN] || 0);
    totalEnergy += sp[ResourceType.POWER] || 0;
    totalFoodSatisfaction += city.foodPerTick;
    totalEnergySatisfaction += city.energyPerTick;
    cityCount++;
  }

  for (const [, building] of state.buildings) {
    if (building.ownerId !== playerId) continue;
    if (building.productionTicksRemaining > 0) continue;
    if (building.type === 'FACTORY') factoryCount++;
  }

  return {
    food: Math.floor(totalFood),
    energy: Math.floor(totalEnergy),
    foodPerTick: roundDisplay(cityCount > 0 ? totalFoodSatisfaction / cityCount : 0),
    energyPerTick: roundDisplay(cityCount > 0 ? totalEnergySatisfaction / cityCount : 0),
    totalPopulation,
    factoryCount,
  };
}