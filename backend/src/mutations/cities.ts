import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { getNextCityName } from './cityNames';
import {
  CFG,
  getUnitProductionCosts,
  getFoodValue,
  getMaterialValue,
  type ProductionItem,
} from '@vantaris/shared';
import { initCityStockpile, getCityStockpileAmount, consumeFromCityStockpile, getCityStockpile, setCityStockpile } from './resources';

const UNIT_PRODUCTION_COSTS = getUnitProductionCosts(CFG);
const FOOD_VALUE = getFoodValue(CFG);
const MATERIAL_VALUE = getMaterialValue(CFG);

let cityIdCounter = 0;

export function getProductionCost(unitType: string): { ticksCost: number; resourceCost: Record<string, number>; popCost: number } {
  const cost = UNIT_PRODUCTION_COSTS.find(c => c.type === unitType);
  return cost ? { ticksCost: cost.ticksCost, resourceCost: { ...cost.resourceCost }, popCost: cost.popCost } : { ticksCost: 100, resourceCost: { BREAD: 20 }, popCost: 1 };
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
    city.productionResourcesInvested = JSON.stringify({});
  } else {
    city.productionTicksRemaining = 0;
    city.productionTicksTotal = 0;
    city.productionResourcesInvested = JSON.stringify({});
  }
}

function getResourcesInvested(city: CityState): Record<string, number> {
  try { return JSON.parse(city.productionResourcesInvested); } catch { return {}; }
}

function setResourcesInvested(city: CityState, invested: Record<string, number>): void {
  city.productionResourcesInvested = JSON.stringify(invested);
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
  city.name = getNextCityName();
  city.tier = 1;
  city.xp = 0;
  city.population = CFG.CITY.POPULATION_INITIAL;

  setRepeatQueue(city, []);
  const cost = getProductionCost('INFANTRY');
  setPriorityQueue(city, [{ type: 'INFANTRY', ticksCost: cost.ticksCost, resourceCost: cost.resourceCost, popCost: cost.popCost }]);

  initCityStockpile(city);

  startNextProduction(city);

  const cell = state.cells.get(cellId);
  if (cell) {
    cell.hasCity = true;
    cell.cityId = city.cityId;
    if (cell.ruin) {
      cell.ruin = '';
      cell.ruinRevealed = false;
    }
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
    popCost: cost.popCost,
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

function deductFoodFromCity(city: CityState, amount: number): boolean {
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
    const unitsToTake = Math.min(available, foodToTake / value);
    consumeFromCityStockpile(city, res, unitsToTake);
    remaining -= unitsToTake * value;
  }

  return remaining <= 0.01;
}

function deductMaterialFromCity(city: CityState, amount: number): boolean {
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
    const unitsToTake = Math.min(available, matToTake / value);
    consumeFromCityStockpile(city, res, unitsToTake);
    remaining -= unitsToTake * value;
  }

  return remaining <= 0.01;
}

export function canCityAffordProduction(city: CityState): boolean {
  const current = getCurrentProduction(city);
  if (!current) return true;
  if (city.population < current.popCost + 1) return false;

  for (const [resource, amount] of Object.entries(current.resourceCost)) {
    if (resource === 'FOOD') {
      let foodAvailable = 0;
      for (const [res, value] of Object.entries(FOOD_VALUE)) {
        if (value > 0) foodAvailable += getCityStockpileAmount(city, res) * value;
      }
      const invested = getResourcesInvested(city);
      const foodInvested = invested['FOOD'] || 0;
      if (foodAvailable - foodInvested < amount) return false;
    } else if (resource === 'MATERIAL') {
      let matAvailable = 0;
      for (const [res, value] of Object.entries(MATERIAL_VALUE)) {
        if (value > 0) matAvailable += getCityStockpileAmount(city, res) * value;
      }
      const invested = getResourcesInvested(city);
      const matInvested = invested['MATERIAL'] || 0;
      if (matAvailable - matInvested < amount) return false;
    } else {
      const available = getCityStockpileAmount(city, resource);
      const invested = getResourcesInvested(city);
      const resInvested = invested[resource] || 0;
      if (available - resInvested < amount) return false;
    }
  }
  return true;
}

export function investProductionTick(city: CityState): void {
  const current = getCurrentProduction(city);
  if (!current) return;
  if (city.productionTicksTotal <= 0) return;

  const fraction = 1 / city.productionTicksTotal;
  const invested = getResourcesInvested(city);

  for (const [resource, totalAmount] of Object.entries(current.resourceCost)) {
    const perTick = totalAmount * fraction;
    if (resource === 'FOOD') {
      let remaining = perTick;
      const foodOrder = Object.entries(FOOD_VALUE)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a);

      for (const [res, value] of foodOrder) {
        if (remaining <= 0.001) break;
        const sp = getCityStockpile(city);
        const available = (sp[res] || 0) - (invested[`${res}_FOOD`] || 0);
        if (available <= 0) continue;
        const foodFromThis = available * value;
        const foodToTake = Math.min(foodFromThis, remaining);
        const unitsToTake = Math.min(available, foodToTake / value);
        invested[`${res}_FOOD`] = (invested[`${res}_FOOD`] || 0) + unitsToTake;
        remaining -= unitsToTake * value;
      }
      invested['FOOD'] = (invested['FOOD'] || 0) + (perTick - remaining);
    } else if (resource === 'MATERIAL') {
      let remaining = perTick;
      const matOrder = Object.entries(MATERIAL_VALUE)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a);

      for (const [res, value] of matOrder) {
        if (remaining <= 0.001) break;
        const sp = getCityStockpile(city);
        const available = (sp[res] || 0) - (invested[`${res}_MATERIAL`] || 0);
        if (available <= 0) continue;
        const matFromThis = available * value;
        const matToTake = Math.min(matFromThis, remaining);
        const unitsToTake = Math.min(available, matToTake / value);
        invested[`${res}_MATERIAL`] = (invested[`${res}_MATERIAL`] || 0) + unitsToTake;
        remaining -= unitsToTake * value;
      }
      invested['MATERIAL'] = (invested['MATERIAL'] || 0) + (perTick - remaining);
    } else {
      const sp = getCityStockpile(city);
      const available = (sp[resource] || 0) - (invested[resource] || 0);
      const toInvest = Math.min(perTick, available);
      invested[resource] = (invested[resource] || 0) + toInvest;
    }
  }

  setResourcesInvested(city, invested);
}

export function consumeProductionCosts(city: CityState, item: ProductionItem): boolean {
  if (city.population < item.popCost + 1) return false;
  city.population -= item.popCost;

  const invested = getResourcesInvested(city);

  for (const [resource, amount] of Object.entries(item.resourceCost)) {
    if (resource === 'FOOD') {
      for (const [key, value] of Object.entries(invested)) {
        if (key.endsWith('_FOOD')) {
          const res = key.replace('_FOOD', '');
          consumeFromCityStockpile(city, res, value);
        }
      }
    } else if (resource === 'MATERIAL') {
      for (const [key, value] of Object.entries(invested)) {
        if (key.endsWith('_MATERIAL')) {
          const res = key.replace('_MATERIAL', '');
          consumeFromCityStockpile(city, res, value);
        }
      }
    } else {
      const resInvested = invested[resource] || 0;
      consumeFromCityStockpile(city, resource, resInvested);
    }
  }

  setResourcesInvested(city, {});
  return true;
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
    popCost: cost.popCost,
  });
  setPriorityQueue(city, queue);
}

export function clearPriorityQueue(city: CityState): void {
  setPriorityQueue(city, []);
}

export function awardCityXP(city: CityState, xp: number): void {
  city.xp += xp;

  for (let i = CFG.CITY.TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (city.xp >= CFG.CITY.TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
      city.tier = i + 1;
      break;
    }
  }
}

