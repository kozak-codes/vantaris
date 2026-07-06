import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { ResourceType, CFG } from '@vantaris/shared';
import type { ResourceInflowEntry } from '@vantaris/shared';

const ROUND_PRECISION = 0.001;

function roundValue(v: number): number {
  return Math.round(v / ROUND_PRECISION) * ROUND_PRECISION;
}

function roundDisplay(v: number): number {
  return Math.round(v * 10) / 10;
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

export function tickCityResourceDrain(state: GameState): void {
  for (const [, city] of state.cities) {
    const sp = getCityStockpile(city);
    setCityStockpile(city, sp);
    city.foodPerTick = 1;
    city.energyPerTick = 1;
  }
}

export function tickCityXP(state: GameState): void {
  for (const [, city] of state.cities) {
    city.xp += 1;

    for (let i = CFG.CITY.TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
      if (city.xp >= CFG.CITY.TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
        city.tier = i + 1;
        break;
      }
    }
  }
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

  return {
    food: Math.floor(totalFood),
    energy: Math.floor(totalEnergy),
    foodPerTick: roundDisplay(cityCount > 0 ? totalFoodSatisfaction / cityCount : 0),
    energyPerTick: roundDisplay(cityCount > 0 ? totalEnergySatisfaction / cityCount : 0),
    totalPopulation,
    factoryCount: 0,
  };
}