import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { BuildingState } from '../state/BuildingState';
import { ResourceType } from '@vantaris/shared';
import {
  CITY_TIER_MANPOWER,
  CITY_TIER_XP_THRESHOLDS,
  CITY_XP_PER_POP_PER_10,
  POPULATION_GROWTH_BASE,
  POPULATION_GROWTH_FOOD_BONUS,
  POPULATION_DECLINE_THRESHOLD,
  POPULATION_DECLINE_RATE,
  POPULATION_STARVATION_THRESHOLD,
  POPULATION_STARVATION_RATE,
  EXTRACTOR_OUTPUT,
  SUPPLY_CHAIN_MAX_HOPS,
  SUPPLY_CHAIN_DISTANCE_PENALTY,
  FACTORY_RECIPES,
  FACTORY_XP_PER_CYCLE,
  FACTORY_TIER_THRESHOLDS,
  CITY_FOOD_DRAIN_PER_POP,
  CITY_POWER_DRAIN_BASE,
  CITY_BASE_GRAIN_RATE,
  CITY_INITIAL_STOCKPILE,
  RAW_RESOURCES,
  CITY_BREAD_EMERGENCY_GRAIN_RATIO,
} from '@vantaris/shared/constants';
import { getBuildingStockpile, setBuildingStockpile, getBuildingStockpileAmount, addToBuildingStockpile } from './buildings';
import type { AdjacencyMap } from '@vantaris/shared';

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
    if (v !== 0) filtered[k] = v;
  }
  city.stockpile = JSON.stringify(filtered);
}

export function getCityStockpileAmount(city: CityState, resource: string): number {
  return getCityStockpile(city)[resource] || 0;
}

export function addToCityStockpile(city: CityState, resource: string, amount: number): void {
  const sp = getCityStockpile(city);
  sp[resource] = (sp[resource] || 0) + amount;
  setCityStockpile(city, sp);
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
  for (const [k, v] of Object.entries(CITY_INITIAL_STOCKPILE)) {
    sp[k] = v;
  }
  setCityStockpile(city, sp);
}

function findNearestStorage(
  cellId: string,
  ownerId: string,
  state: GameState,
  adjacencyMap: AdjacencyMap,
): { type: 'city' | 'factory'; id: string; distance: number } | null {
  const visited = new Set<string>([cellId]);
  let frontier = [cellId];

  for (let dist = 0; dist <= SUPPLY_CHAIN_MAX_HOPS; dist++) {
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

    const target = findNearestStorage(building.cellId, building.ownerId, state, adjacencyMap);
    if (!target) continue;

    const penalty = 1.0 - (target.distance * SUPPLY_CHAIN_DISTANCE_PENALTY);
    const delivered = Math.max(0.01, output.amount * Math.max(0.1, penalty));

    if (target.type === 'city') {
      const city = state.cities.get(target.id);
      if (city) addToCityStockpile(city, output.resource, delivered);
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

    const recipe = FACTORY_RECIPES.find(r => r.id === building.recipe);
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
      building.recipeTicksRemaining = recipe.ticksPerCycle;
    }
    building.recipeTicksRemaining--;

    if (building.recipeTicksRemaining <= 0) {
      for (const out of recipe.output) {
        addToBuildingStockpile(building, out.resource, out.amount);
      }
      building.factoryXp += FACTORY_XP_PER_CYCLE;
      building.recipeTicksRemaining = recipe.ticksPerCycle;

      for (let i = FACTORY_TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (building.factoryXp >= FACTORY_TIER_THRESHOLDS[i] && i + 1 > building.factoryTier) {
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

      const target = findNearestStorage(building.cellId, building.ownerId, state, adjacencyMap);
      if (!target || target.type !== 'city') continue;

      const city = state.cities.get(target.id);
      if (!city) continue;

      const penalty = Math.max(0.1, 1.0 - (target.distance * SUPPLY_CHAIN_DISTANCE_PENALTY));
      const delivered = amount * penalty;

      const newSp = getBuildingStockpile(building);
      newSp[res] = 0;
      setBuildingStockpile(building, newSp);

      addToCityStockpile(city, res, delivered);
    }
  }
}

export function tickCityResourceDrain(state: GameState): void {
  for (const [, city] of state.cities) {
    const sp = getCityStockpile(city);
    sp[ResourceType.GRAIN] = (sp[ResourceType.GRAIN] || 0) + CITY_BASE_GRAIN_RATE;

    const pop = city.population;
    if (pop <= 0) {
      setCityStockpile(city, sp);
      city.foodPerTick = 0;
      city.energyPerTick = 1;
      continue;
    }

    const breadDrain = pop * CITY_FOOD_DRAIN_PER_POP;
    const powerDrain = CITY_POWER_DRAIN_BASE + (city.tier - 1) * 0.3;

    const breadAvailable = sp[ResourceType.BREAD] || 0;

    let breadConsumed = Math.min(breadAvailable, breadDrain);
    if (breadConsumed < breadDrain) {
      const grainAvailable = sp[ResourceType.GRAIN] || 0;
      const grainNeeded = (breadDrain - breadConsumed) * CITY_BREAD_EMERGENCY_GRAIN_RATIO;
      const grainConsumed = Math.min(grainAvailable, grainNeeded);
      breadConsumed += grainConsumed / CITY_BREAD_EMERGENCY_GRAIN_RATIO;
      sp[ResourceType.GRAIN] = Math.max(0, (sp[ResourceType.GRAIN] || 0) - grainConsumed);
    }
    sp[ResourceType.BREAD] = Math.max(0, (sp[ResourceType.BREAD] || 0) - breadConsumed);

    const powerAvailable = sp[ResourceType.POWER] || 0;
    const powerConsumed = Math.min(powerAvailable, powerDrain);
    sp[ResourceType.POWER] = Math.max(0, (sp[ResourceType.POWER] || 0) - powerConsumed);

    const foodSatisfaction = breadDrain > 0 ? breadConsumed / breadDrain : 0;
    city.foodPerTick = foodSatisfaction;
    city.energyPerTick = powerDrain > 0 ? powerConsumed / powerDrain : 1;

    setCityStockpile(city, sp);
  }
}

export function tickPopulation(state: GameState): void {
  for (const [, city] of state.cities) {
    const foodSatisfaction = city.foodPerTick;
    const popCap = getPopulationCap(city.tier);

    if (foodSatisfaction >= 1.0 && city.population < popCap) {
      const growth = POPULATION_GROWTH_BASE + POPULATION_GROWTH_FOOD_BONUS * foodSatisfaction;
      city.population = Math.min(popCap, city.population + growth);
    } else if (foodSatisfaction < POPULATION_DECLINE_THRESHOLD && city.population > 0) {
      if (foodSatisfaction <= POPULATION_STARVATION_THRESHOLD) {
        city.population = Math.max(0, city.population - POPULATION_STARVATION_RATE);
      } else {
        city.population = Math.max(0, city.population - POPULATION_DECLINE_RATE);
      }
    }

    if (city.population >= popCap) {
      city.population = Math.floor(popCap);
    }
  }
}

export function tickCityXP(state: GameState): void {
  for (const [, city] of state.cities) {
    const baseXP = Math.floor(city.population / 10) * CITY_XP_PER_POP_PER_10;
    let xp = baseXP;

    if (city.foodPerTick >= 1.0) xp = Math.floor(xp * 1.5);
    if (city.energyPerTick >= 1.0) xp = Math.floor(xp * 1.3);

    city.xp += xp;

    for (let i = CITY_TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (city.xp >= CITY_TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
        city.tier = i + 1;
        break;
      }
    }
  }
}

function getPopulationCap(tier: number): number {
  const caps: Record<number, number> = { 1: 50, 2: 150, 3: 400, 4: 1000, 5: 3000, 6: 10000 };
  return caps[tier] ?? 50;
}

export function computePlayerResourceSummary(state: GameState, playerId: string): {
  food: number; energy: number; manpower: number;
  foodPerTick: number; energyPerTick: number; manpowerPerTick: number;
  totalPopulation: number; factoryCount: number;
} {
  let totalPopulation = 0;
  let factoryCount = 0;
  let totalFood = 0;
  let totalEnergy = 0;
  let manpower = 0;

  for (const [, city] of state.cities) {
    if (city.ownerId !== playerId) continue;
    totalPopulation += Math.floor(city.population);
    const sp = getCityStockpile(city);
    totalFood += (sp[ResourceType.BREAD] || 0) + (sp[ResourceType.GRAIN] || 0);
    totalEnergy += sp[ResourceType.POWER] || 0;
    const tier = city.tier;
    manpower += CITY_TIER_MANPOWER[tier] ?? 2;
  }

  for (const [, building] of state.buildings) {
    if (building.ownerId !== playerId) continue;
    if (building.productionTicksRemaining > 0) continue;
    if (building.type === 'FACTORY') factoryCount++;
  }

  return {
    food: Math.floor(totalFood),
    energy: Math.floor(totalEnergy),
    manpower,
    foodPerTick: 0,
    energyPerTick: 0,
    manpowerPerTick: 0,
    totalPopulation,
    factoryCount,
  };
}