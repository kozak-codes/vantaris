import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { CITY_TROOP_PRODUCTION_TICKS, CITY_TIER_XP_THRESHOLDS, PASSIVE_EXPANSION_TICKS, UNIT_PRODUCTION_COSTS, CITY_INITIAL_STOCKPILE, FOOD_VALUE, MATERIAL_VALUE } from '@vantaris/shared/constants';
import type { ProductionItem } from '@vantaris/shared';
import { initCityStockpile, getCityStockpileAmount, consumeFromCityStockpile } from './resources';

let cityIdCounter = 0;

export const ENGINEER_PRODUCTION_TICKS = 300;

export function getProductionCost(unitType: string): { ticksCost: number; resourceCost: Record<string, number>; manpowerCost: number } {
  const cost = UNIT_PRODUCTION_COSTS.find(c => c.type === unitType);
  return cost ? { ticksCost: cost.ticksCost, resourceCost: { ...cost.resourceCost }, manpowerCost: cost.manpowerCost } : { ticksCost: 100, resourceCost: { BREAD: 20 }, manpowerCost: 1 };
}

export function getRepeatQueue(city: CityState): string[] {
  try { return JSON.parse(city.repeatQueue); } catch { return ['INFANTRY']; }
}

export function setRepeatQueue(city: CityState, queue: string[]): void {
  city.repeatQueue = JSON.stringify(queue);
}

export function getPriorityQueue(city: CityState): ProductionItem[] {
  try { return JSON.parse(city.priorityQueue); } catch { return []; }
}

export function setPriorityQueue(city: CityState, queue: ProductionItem[]): void {
  city.priorityQueue = JSON.stringify(queue);
}

export function getCurrentProduction(city: CityState): ProductionItem | null {
  if (!city.currentProduction) return null;
  try { return JSON.parse(city.currentProduction); } catch { return null; }
}

export function setCurrentProduction(city: CityState, item: ProductionItem | null): void {
  city.currentProduction = item ? JSON.stringify(item) : '';
  if (item) {
    city.productionTicksRemaining = item.ticksCost;
    city.productionTicksTotal = item.ticksCost;
  } else {
    city.productionTicksRemaining = 0;
    city.productionTicksTotal = 0;
  }
}

export function createCity(
  state: GameState,
  ownerId: string,
  cellId: string,
): CityState {
  const city = new CityState();
  city.cityId = `city_${cityIdCounter++}`;
  city.ownerId = ownerId;
  city.cellId = cellId;
  city.tier = 1;
  city.xp = 0;
  city.population = 0;
  city.passiveExpandCooldown = 0;

  setRepeatQueue(city, []);
  const cost = getProductionCost('INFANTRY');
  setPriorityQueue(city, [{ type: 'INFANTRY', ticksCost: cost.ticksCost, resourceCost: cost.resourceCost, manpowerCost: cost.manpowerCost }]);

  initCityStockpile(city);

  startNextProduction(city);

  const cell = state.cells.get(cellId);
  if (cell) {
    cell.hasCity = true;
    cell.cityId = city.cityId;
  }

  state.cities.set(city.cityId, city);
  return city;
}

export function startNextProduction(city: CityState): boolean {
  const priorityQ = getPriorityQueue(city);
  if (priorityQ.length > 0) {
    const item = priorityQ.shift()!;
    setPriorityQueue(city, priorityQ);
    setCurrentProduction(city, item);
    return true;
  }

  const repeatQ = getRepeatQueue(city);
  if (repeatQ.length === 0) {
    setCurrentProduction(city, null);
    return false;
  }

  const type = repeatQ[0];
  const cost = getProductionCost(type);
  setCurrentProduction(city, {
    type,
    ticksCost: cost.ticksCost,
    resourceCost: cost.resourceCost,
    manpowerCost: cost.manpowerCost,
  });

  if (repeatQ.length > 1) {
    const rotated = [...repeatQ.slice(1), repeatQ[0]];
    setRepeatQueue(city, rotated);
  }

  return true;
}

export function tickCityProduction(city: CityState): ProductionItem | null {
  const current = getCurrentProduction(city);
  if (!current) {
    startNextProduction(city);
    return null;
  }

  if (city.productionTicksRemaining <= 0) {
    const completed = current;
    startNextProduction(city);
    return completed;
  }

  city.productionTicksRemaining--;
  if (city.productionTicksRemaining <= 0) {
    const completed = current;
    startNextProduction(city);
    return completed;
  }

  return null;
}

export function canCityAffordProduction(city: CityState): boolean {
  const current = getCurrentProduction(city);
  if (!current) return true;
  if (city.population < current.manpowerCost + 1) return false;

  for (const [resource, amount] of Object.entries(current.resourceCost)) {
    if (resource === 'FOOD') {
      let foodAvailable = 0;
      for (const [res, value] of Object.entries(FOOD_VALUE)) {
        if (value > 0) foodAvailable += getCityStockpileAmount(city, res) * value;
      }
      if (foodAvailable < amount) return false;
    } else if (resource === 'MATERIAL') {
      let matAvailable = 0;
      for (const [res, value] of Object.entries(MATERIAL_VALUE)) {
        if (value > 0) matAvailable += getCityStockpileAmount(city, res) * value;
      }
      if (matAvailable < amount) return false;
    } else {
      if (getCityStockpileAmount(city, resource) < amount) return false;
    }
  }
  return true;
}

export function consumeProductionCosts(city: CityState, item: ProductionItem): boolean {
  if (city.population < item.manpowerCost + 1) return false;
  city.population -= item.manpowerCost;

  for (const [resource, amount] of Object.entries(item.resourceCost)) {
    if (resource === 'FOOD') {
      deductFoodFromCity(city, amount);
    } else if (resource === 'MATERIAL') {
      deductMaterialFromCity(city, amount);
    } else {
      consumeFromCityStockpile(city, resource, amount);
    }
  }

  return true;
}

function deductFoodFromCity(city: CityState, amount: number): void {
  let remaining = amount;
  const foodOrder = Object.entries(FOOD_VALUE)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  for (const [res, value] of foodOrder) {
    if (remaining <= 0.01) break;
    const available = getCityStockpileAmount(city, res);
    if (available <= 0) continue;
    const foodFromThis = available * value;
    const foodToTake = Math.min(foodFromThis, remaining);
    const unitsToTake = Math.ceil(foodToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      consumeFromCityStockpile(city, res, actualTaken);
      remaining -= actualTaken * value;
    }
  }
}

function deductMaterialFromCity(city: CityState, amount: number): void {
  let remaining = amount;
  const matOrder = Object.entries(MATERIAL_VALUE)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  for (const [res, value] of matOrder) {
    if (remaining <= 0.01) break;
    const available = getCityStockpileAmount(city, res);
    if (available <= 0) continue;
    const matFromThis = available * value;
    const matToTake = Math.min(matFromThis, remaining);
    const unitsToTake = Math.ceil(matToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      consumeFromCityStockpile(city, res, actualTaken);
      remaining -= actualTaken * value;
    }
  }
}

export function addToRepeatQueue(city: CityState, unitType: string): void {
  const queue = getRepeatQueue(city);
  queue.push(unitType);
  setRepeatQueue(city, queue);
}

export function removeFromRepeatQueue(city: CityState, index: number): void {
  const queue = getRepeatQueue(city);
  if (index >= 0 && index < queue.length) {
    queue.splice(index, 1);
    setRepeatQueue(city, queue);
  }
}

export function setRepeatQueueEntry(city: CityState, index: number, unitType: string): void {
  const queue = getRepeatQueue(city);
  if (index >= 0 && index < queue.length) {
    queue[index] = unitType;
    setRepeatQueue(city, queue);
  }
}

export function addPriorityItem(city: CityState, unitType: string): void {
  const cost = getProductionCost(unitType);
  const queue = getPriorityQueue(city);
  queue.push({
    type: unitType,
    ticksCost: cost.ticksCost,
    resourceCost: cost.resourceCost,
    manpowerCost: cost.manpowerCost,
  });
  setPriorityQueue(city, queue);
}

export function clearPriorityQueue(city: CityState): void {
  setPriorityQueue(city, []);
}

export function awardCityXP(city: CityState, xp: number): void {
  city.xp += xp;

  for (let i = CITY_TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (city.xp >= CITY_TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
      city.tier = i + 1;
      break;
    }
  }
}

export function tickPassiveExpansion(
  state: GameState,
  city: CityState,
  adjacencyMap: { [cellId: string]: string[] },
): string | null {
  const interval = PASSIVE_EXPANSION_TICKS[city.tier] ?? 0;
  if (interval === 0) return null;

  if (city.passiveExpandCooldown > 0) {
    city.passiveExpandCooldown--;
    return null;
  }

  const neighbors = adjacencyMap[city.cellId] ?? [];
  for (const nId of neighbors) {
    const nCell = state.cells.get(nId);
    if (nCell && !nCell.ownerId && nCell.biome !== 'OCEAN') {
      return nId;
    }
  }

  const frontier: string[] = [];
  const visited = new Set<string>([city.cellId, ...neighbors]);
  let current = [...neighbors];
  for (let depth = 0; depth < 3; depth++) {
    const next: string[] = [];
    for (const cid of current) {
      const cell = state.cells.get(cid);
      if (cell && cell.ownerId === city.ownerId) {
        for (const adjId of (adjacencyMap[cid] ?? [])) {
          if (!visited.has(adjId)) {
            visited.add(adjId);
            const adjCell = state.cells.get(adjId);
            if (adjCell && !adjCell.ownerId && adjCell.biome !== 'OCEAN') {
              frontier.push(adjId);
            } else if (adjCell && adjCell.ownerId === city.ownerId) {
              next.push(adjId);
            }
          }
        }
      }
    }
    if (frontier.length > 0) break;
    current = next;
  }

  if (frontier.length > 0) return frontier[0];

  city.passiveExpandCooldown = interval;
  return null;
}