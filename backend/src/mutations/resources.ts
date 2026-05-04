import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { BuildingState } from '../state/BuildingState';
import { UnitState } from '../state/UnitState';
import { ResourceType, CFG, getExtractorOutput, getFactoryRecipes, UnitStatus } from '@vantaris/shared';
import { getBuildingStockpile, setBuildingStockpile, getBuildingStockpileAmount, addToBuildingStockpile } from './buildings';
import type { AdjacencyMap, ResourceInflowEntry } from '@vantaris/shared';

const EXTRACTOR_OUTPUT = getExtractorOutput(CFG);

const ROUND_PRECISION = 0.001;

function roundValue(v: number): number {
  return Math.round(v / ROUND_PRECISION) * ROUND_PRECISION;
}

function roundDisplay(v: number): number {
  return Math.round(v * 10) / 10;
}

export function tickBuildingWages(state: GameState, tick: number): void {
  if (tick % 100 !== 0) return;

  for (const [, building] of state.buildings) {
    if (building.productionTicksRemaining > 0) continue;

    const wage = building.wagePer100Ticks;
    if (wage <= 0) continue;

    const sp = getBuildingStockpile(building);
    const totalStock = Object.values(sp).reduce((sum, v) => sum + v, 0);
    const target = building.stockpileTarget || 0;
    if (target <= 0 || totalStock < target) continue;

    const owner = state.players.get(building.ownerId);
    if (!owner || owner.energyCredits < wage) continue;

    let citizenOnTile: string | null = null;
    for (const [, unit] of state.units) {
      if (unit.cellId === building.cellId && unit.ownerId === building.ownerId) {
        citizenOnTile = unit.unitId;
        break;
      }
    }

    if (citizenOnTile) {
      const unit = state.units.get(citizenOnTile)!;
      owner.energyCredits -= wage;
      unit.energyCredits += wage;
    }
  }
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

export function tickCitizenVitals(state: GameState, cellPositions: Record<string, [number, number, number]>): void {
  const deadUnits: string[] = [];
  const sunAngle = state.getSunAngle();

  for (const [, unit] of state.units) {
    const vitals = CFG.CITIZEN_VITALS;

    if (unit.hunger > 0) {
      unit.hunger = Math.max(0, unit.hunger - vitals.HUNGER_DRAIN_PER_TICK);
    }

    let restDrain = vitals.REST_DRAIN_PER_TICK;
    const unitCell = state.cells.get(unit.cellId);
    if (unitCell) {
      const cellPos = cellPositions[unit.cellId];
      if (cellPos) {
        const len = Math.sqrt(cellPos[0] * cellPos[0] + cellPos[1] * cellPos[1] + cellPos[2] * cellPos[2]);
        if (len > 0) {
          const nx = cellPos[0] / len;
          const nz = cellPos[2] / len;
          const dot = nx * Math.cos(sunAngle) + nz * Math.sin(sunAngle);
          if (dot < -0.2) {
            restDrain = vitals.REST_DRAIN_PER_TICK * 1.5;
          }
        }
      }
    }
    if (unit.rest > 0) {
      unit.rest = Math.max(0, unit.rest - restDrain);
    }

    if (unit.hunger <= 0) {
      unit.health = Math.max(0, unit.health - vitals.HEALTH_LOSS_WHEN_HUNGRY_PER_TICK);
    }

    if (unit.health <= 0) {
      deadUnits.push(unit.unitId);
      continue;
    }

    if (unit.status === 'RETURNING') {
      const city = state.cities.get(unit.homeCityId);
      if (city) {
        if (unit.hunger < vitals.MAX_HUNGER && city.homesAvailable > 0) {
          const owner = state.players.get(unit.ownerId);
          const foodCreditRate = owner?.foodCreditRate ?? 1;
          const foodCost = vitals.HUNGER_RECHARGE_FOOD_COST;
          const creditCost = foodCost * foodCreditRate;
          const citySp = getCityStockpile(city);
          const grainAvailable = citySp[ResourceType.GRAIN] || 0;
          const breadAvailable = citySp[ResourceType.BREAD] || 0;
          const canAffordCredits = !owner || owner.energyCredits >= creditCost;

          if (canAffordCredits && grainAvailable >= foodCost) {
            citySp[ResourceType.GRAIN] = grainAvailable - foodCost;
            unit.hunger = Math.min(vitals.MAX_HUNGER, unit.hunger + vitals.HUNGER_RECHARGE_PER_TICK);
            if (owner) owner.energyCredits -= creditCost;
            setCityStockpile(city, citySp);
          } else if (canAffordCredits && breadAvailable >= foodCost) {
            citySp[ResourceType.BREAD] = breadAvailable - foodCost;
            unit.hunger = Math.min(vitals.MAX_HUNGER, unit.hunger + vitals.HUNGER_RECHARGE_PER_TICK);
            if (owner) owner.energyCredits -= creditCost;
            setCityStockpile(city, citySp);
          }
        }

        if (unit.rest < vitals.MAX_REST) {
          unit.rest = Math.min(vitals.MAX_REST, unit.rest + vitals.REST_RECHARGE_PER_TICK);
        }

        if (unit.health < vitals.MAX_HEALTH && unit.hunger > vitals.HUNGER_THRESHOLD) {
          unit.health = Math.min(vitals.MAX_HEALTH, unit.health + vitals.HEALTH_RECHARGE_PER_TICK);
        }

        const isReadyToWork = unit.rest >= vitals.MAX_REST
          && unit.health >= vitals.HEALTH_THRESHOLD
          && (unit.hunger >= vitals.MAX_HUNGER || unit.hunger > vitals.HUNGER_THRESHOLD);

        if (isReadyToWork) {
          unit.status = UnitStatus.IDLE;
          unit.path = '[]';
          unit.movementTicksRemaining = 0;
          unit.movementTicksTotal = 0;
        }
      }
    }
  }

  for (const unitId of deadUnits) {
    state.units.delete(unitId);
  }
}

export function tickExtractorOutput(state: GameState, cellPositions: Record<string, [number, number, number]>): void {
  const sunAngle = state.getSunAngle();
  const sunDirX = Math.cos(sunAngle);
  const sunDirZ = Math.sin(sunAngle);

  for (const [, building] of state.buildings) {
    if (building.productionTicksRemaining > 0) continue;

    const output = EXTRACTOR_OUTPUT[building.type];
    if (!output) continue;

    if (building.type === 'FARM') {
      const pos = cellPositions[building.cellId];
      if (pos) {
        const len = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]);
        if (len > 0) {
          const nx = pos[0] / len;
          const nz = pos[2] / len;
          const dot = nx * sunDirX + nz * sunDirZ;
          if (dot < 0) continue;
        }
      }

      let hasWorker = false;
      for (const [, unit] of state.units) {
        if (unit.cellId === building.cellId && unit.ownerId === building.ownerId) {
          hasWorker = true;
          break;
        }
      }
      if (!hasWorker) continue;
    }

    addToBuildingStockpile(building, output.resource, output.amount);
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

export function tickCityResourceDrain(state: GameState): void {
  for (const [, city] of state.cities) {
    const sp = getCityStockpile(city);
    setCityStockpile(city, sp);
    city.foodPerTick = 1;
    city.energyPerTick = 1;
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