import { GameState } from '../state/GameState';
import { BuildingState } from '../state/BuildingState';
import {
  ResourceType,
  CFG,
  type ICFG,
  getCellBuildingCapacity as computeCellBuildingCapacity,
  getBuildingTicks,
  getBuildingPlacementRules,
  getBuildingCosts,
  getFoodValue,
  getMaterialValue,
  getEngineerBuildableTypes,
  getUnitBuildableTypes,
  type AdjacencyMap,
} from '@vantaris/shared';
import { getCityStockpile, getCityStockpileAmount, setCityStockpile } from './resources';

const CELL_BUILDING_CAPACITY = computeCellBuildingCapacity(CFG);
const BUILDING_TICKS = getBuildingTicks(CFG);
const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);
const BUILDING_COSTS = getBuildingCosts(CFG);
const FOOD_VALUE = getFoodValue(CFG);
const MATERIAL_VALUE = getMaterialValue(CFG);

const ROUND_PRECISION = 0.001;

function roundValue(v: number): number {
  return Math.round(v / ROUND_PRECISION) * ROUND_PRECISION;
}

let buildingIdCounter = 0;

export function getCellBuildingCapacity(cell: { biome: string; isPentagon: boolean }): number {
  const key = cell.isPentagon ? 'PENTAGON' : cell.biome;
  return CELL_BUILDING_CAPACITY[key] ?? 0;
}

export function countBuildingsOnCell(state: GameState, cellId: string): number {
  let count = 0;
  for (const [, b] of state.buildings) {
    if (b.cellId === cellId) count++;
  }
  return count;
}

export function createBuilding(
  state: GameState,
  ownerId: string,
  cellId: string,
  buildingType: string,
): BuildingState | null {
  const cell = state.cells.get(cellId);
  if (!cell) return null;
  if (cell.hasCity) return null;
  if (cell.biome === 'OCEAN') return null;

  const allowedBiomes = BUILDING_PLACEMENT_RULES[buildingType];
  if (allowedBiomes && !allowedBiomes.includes(cell.biome)) return null;

  if (!cell.ownerId || cell.ownerId !== ownerId) return null;

  const capacity = getCellBuildingCapacity(cell);
  const currentCount = countBuildingsOnCell(state, cellId);
  if (currentCount >= capacity) return null;

  const building = new BuildingState();
  building.buildingId = `bldg_${buildingIdCounter++}`;
  building.ownerId = ownerId;
  building.cellId = cellId;
  building.type = buildingType;
  building.productionTicksRemaining = BUILDING_TICKS[buildingType] ?? 200;
  building.recipe = '';
  building.factoryTier = buildingType === 'FACTORY' ? 1 : 0;
  building.factoryXp = 0;
  building.stockpile = '{}';
  building.resourcesInvested = '{"food":0,"material":0}';

  state.buildings.set(building.buildingId, building);

  if (cell.ruin) {
    cell.ruin = '';
    cell.ruinRevealed = false;
  }

  return building;
}

export function tickBuildingProduction(building: BuildingState): boolean {
  if (building.productionTicksRemaining <= 0) return true;

  building.productionTicksRemaining--;
  return building.productionTicksRemaining <= 0;
}

export function removeBuilding(state: GameState, buildingId: string): void {
  const building = state.buildings.get(buildingId);
  if (!building) return;

  state.buildings.delete(buildingId);
}

export function canPlaceBuilding(
  state: GameState,
  cellId: string,
  buildingType: string,
  playerId: string,
  engineerLevel: number = 1,
  unitType: string = 'ENGINEER',
): boolean {
  const cell = state.cells.get(cellId);
  if (!cell) return false;
  if (cell.biome === 'OCEAN') return false;
  if (!cell.ownerId || cell.ownerId !== playerId) return false;

  if (buildingType === 'CITY' && cell.hasCity) return false;

  const buildingConfig = CFG.BUILDINGS[buildingType];
  if (!buildingConfig) return false;

  const allowedBuildings = getUnitBuildableTypes(CFG, unitType, unitType === 'ENGINEER' ? engineerLevel : 1);
  if (!allowedBuildings.includes(buildingType)) return false;

  const allowedBiomes = BUILDING_PLACEMENT_RULES[buildingType];
  if (allowedBiomes && !allowedBiomes.includes(cell.biome)) return false;

  const capacity = getCellBuildingCapacity(cell);
  const currentCount = countBuildingsOnCell(state, cellId);
  if (buildingType !== 'CITY' && currentCount >= capacity) return false;

  return true;
}

export function getAvailableBuildTypes(
  state: GameState,
  cellId: string,
  playerId: string,
  engineerLevel: number = 1,
): string[] {
  const cell = state.cells.get(cellId);
  if (!cell || cell.biome === 'OCEAN') return [];
  if (!cell.ownerId || cell.ownerId !== playerId) return [];

  const capacity = getCellBuildingCapacity(cell);
  const currentCount = countBuildingsOnCell(state, cellId);

  const allowedTypes = getEngineerBuildableTypes(CFG, engineerLevel);
  const available: string[] = [];
  for (const bType of allowedTypes) {
    if (bType === 'CITY' && cell.hasCity) continue;
    if (bType !== 'CITY' && currentCount >= capacity) continue;
    const rules = BUILDING_PLACEMENT_RULES[bType];
    if (rules && !rules.includes(cell.biome)) continue;
    available.push(bType);
  }

  return available;
}

export function getResourcesInvested(building: BuildingState): { food: number; material: number } {
  try {
    return JSON.parse(building.resourcesInvested);
  } catch {
    return { food: 0, material: 0 };
  }
}

function setResourcesInvested(building: BuildingState, invested: { food: number; material: number }): void {
  building.resourcesInvested = JSON.stringify({
    food: roundValue(invested.food),
    material: roundValue(invested.material),
  });
}

export function cancelBuilding(state: GameState, buildingId: string, adjacencyMap: AdjacencyMap): void {
  const building = state.buildings.get(buildingId);
  if (!building) return;
  if (building.productionTicksRemaining <= 0) return;

  const invested = getResourcesInvested(building);
  if (invested.food > 0 || invested.material > 0) {
    const target = findNearestCityForPayment(building.cellId, building.ownerId, state, adjacencyMap);
    if (target) {
      const city = state.cities.get(target.id);
      if (city) {
        if (invested.food > 0) refundFoodValue(city, invested.food);
        if (invested.material > 0) refundMaterialValue(city, invested.material);
      }
    }
  }

  removeBuilding(state, buildingId);
}

export function tickBuildingConstruction(
  state: GameState,
  building: BuildingState,
  adjacencyMap: AdjacencyMap,
): boolean {
  if (building.productionTicksRemaining <= 0) return true;

  const cost = BUILDING_COSTS[building.type];
  if (!cost || (cost.food === 0 && cost.material === 0)) {
    building.productionTicksRemaining--;
    return building.productionTicksRemaining <= 0;
  }

  const totalTicks = BUILDING_TICKS[building.type] ?? 200;
  const invested = getResourcesInvested(building);

  let foodPerTick = cost.food / totalTicks;
  let materialPerTick = cost.material / totalTicks;

  const foodRemaining = cost.food - invested.food;
  const materialRemaining = cost.material - invested.material;

  foodPerTick = Math.min(foodPerTick, Math.max(0, foodRemaining));
  materialPerTick = Math.min(materialPerTick, Math.max(0, materialRemaining));

  const target = findNearestCityForPayment(building.cellId, building.ownerId, state, adjacencyMap);
  if (!target) {
    return false;
  }

  const city = state.cities.get(target.id);
  if (!city) {
    return false;
  }

  let foodToConsume = 0;
  let materialToConsume = 0;

  if (foodPerTick > 0) {
    const foodAvailable = computeFoodValue(city);
    foodToConsume = Math.min(foodPerTick, foodAvailable);
  }

  if (materialPerTick > 0) {
    const materialAvailable = computeMaterialValue(city);
    materialToConsume = Math.min(materialPerTick, materialAvailable);
  }

  if (foodToConsume < foodPerTick - 0.001 || materialToConsume < materialPerTick - 0.001) {
    return false;
  }

  if (foodToConsume > 0) {
    deductFoodValue(city, foodToConsume);
    invested.food = roundValue(invested.food + foodToConsume);
  }

  if (materialToConsume > 0) {
    deductMaterialValue(city, materialToConsume);
    invested.material = roundValue(invested.material + materialToConsume);
  }

  setResourcesInvested(building, invested);

  const allFoodPaid = invested.food >= roundValue(cost.food) - 0.001;
  const allMaterialPaid = invested.material >= roundValue(cost.material) - 0.001;

  if (allFoodPaid && allMaterialPaid) {
    building.productionTicksRemaining = 0;
    return true;
  }

  building.productionTicksRemaining--;
  return building.productionTicksRemaining <= 0;
}

export function canAffordBuildingCost(
  state: GameState,
  cellId: string,
  buildingType: string,
  playerId: string,
  adjacencyMap: AdjacencyMap,
): boolean {
  const cost = BUILDING_COSTS[buildingType];
  if (!cost) return true;

  if (cost.food === 0 && cost.material === 0) return true;

  const target = findNearestCityForPayment(cellId, playerId, state, adjacencyMap);
  if (!target) return false;

  const city = state.cities.get(target.id);
  if (!city) return false;

  if (cost.food > 0) {
    const foodAvailable = computeFoodValue(city);
    if (foodAvailable < cost.food) return false;
  }

  if (cost.material > 0) {
    const materialAvailable = computeMaterialValue(city);
    if (materialAvailable < cost.material) return false;
  }

  return true;
}

function computeFoodValue(city: any): number {
  let total = 0;
  for (const [resource, value] of Object.entries(FOOD_VALUE)) {
    if (value > 0) {
      total += getCityStockpileAmount(city, resource) * value;
    }
  }
  return total;
}

function computeMaterialValue(city: any): number {
  let total = 0;
  for (const [resource, value] of Object.entries(MATERIAL_VALUE)) {
    if (value > 0) {
      total += getCityStockpileAmount(city, resource) * value;
    }
  }
  return total;
}

function deductFoodValue(city: any, amount: number): boolean {
  let remaining = amount;

  const breadValue = FOOD_VALUE['BREAD'] || 0;
  const grainValue = FOOD_VALUE['GRAIN'] || 0;
  const oilValue = FOOD_VALUE['OIL'] || 0;

  const breadOrder = [
    { resource: 'BREAD', value: breadValue },
    { resource: 'GRAIN', value: grainValue },
    { resource: 'OIL', value: oilValue },
  ].filter(r => r.value > 0).sort((a, b) => b.value - a.value);

  for (const { resource, value } of breadOrder) {
    if (remaining <= 0.001) break;
    const available = getCityStockpileAmount(city, resource);
    if (available <= 0) continue;
    const foodFromThis = available * value;
    const foodToTake = Math.min(foodFromThis, remaining);
    const unitsToTake = Math.ceil(foodToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      const sp = getCityStockpile(city);
      sp[resource] = roundValue(sp[resource] - actualTaken);
      setCityStockpile(city, sp);
      remaining -= actualTaken * value;
    }
  }

  return remaining <= 0.001;
}

function deductMaterialValue(city: any, amount: number): boolean {
  let remaining = amount;

  const oreValue = MATERIAL_VALUE['ORE'] || 0;
  const steelValue = MATERIAL_VALUE['STEEL'] || 0;

  const materialOrder = [
    { resource: 'ORE', value: oreValue },
    { resource: 'STEEL', value: steelValue },
  ].filter(r => r.value > 0).sort((a, b) => b.value - a.value);

  for (const { resource, value } of materialOrder) {
    if (remaining <= 0.001) break;
    const available = getCityStockpileAmount(city, resource);
    if (available <= 0) continue;
    const matFromThis = available * value;
    const matToTake = Math.min(matFromThis, remaining);
    const unitsToTake = Math.ceil(matToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      const sp = getCityStockpile(city);
      sp[resource] = roundValue(sp[resource] - actualTaken);
      setCityStockpile(city, sp);
      remaining -= actualTaken * value;
    }
  }

  return remaining <= 0.001;
}

function refundFoodValue(city: any, amount: number): void {
  let remaining = amount;

  const breadValue = FOOD_VALUE['BREAD'] || 0;
  const grainValue = FOOD_VALUE['GRAIN'] || 0;
  const oilValue = FOOD_VALUE['OIL'] || 0;

  const refundOrder = [
    { resource: 'GRAIN', value: grainValue },
    { resource: 'OIL', value: oilValue },
    { resource: 'BREAD', value: breadValue },
  ].filter(r => r.value > 0).sort((a, b) => a.value - b.value);

  for (const { resource, value } of refundOrder) {
    if (remaining <= 0.001) break;
    const unitsRefundable = remaining / value;
    const sp = getCityStockpile(city);
    sp[resource] = roundValue((sp[resource] || 0) + unitsRefundable);
    setCityStockpile(city, sp);
    remaining -= unitsRefundable * value;
  }
}

function refundMaterialValue(city: any, amount: number): void {
  let remaining = amount;

  const oreValue = MATERIAL_VALUE['ORE'] || 0;
  const steelValue = MATERIAL_VALUE['STEEL'] || 0;

  const refundOrder = [
    { resource: 'ORE', value: oreValue },
    { resource: 'STEEL', value: steelValue },
  ].filter(r => r.value > 0).sort((a, b) => a.value - b.value);

  for (const { resource, value } of refundOrder) {
    if (remaining <= 0.001) break;
    const unitsRefundable = remaining / value;
    const sp = getCityStockpile(city);
    sp[resource] = roundValue((sp[resource] || 0) + unitsRefundable);
    setCityStockpile(city, sp);
    remaining -= unitsRefundable * value;
  }
}

function findNearestCityForPayment(
  cellId: string,
  ownerId: string,
  state: GameState,
  adjacencyMap: AdjacencyMap,
): { id: string; distance: number } | null {
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
            return { id: city.cityId, distance: dist };
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

export function getBuildingStockpile(building: BuildingState): Record<string, number> {
  try {
    return JSON.parse(building.stockpile);
  } catch {
    return {};
  }
}

export function setBuildingStockpile(building: BuildingState, stockpile: Record<string, number>): void {
  const filtered: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockpile)) {
    const rv = roundValue(v);
    if (rv !== 0) filtered[k] = rv;
  }
  building.stockpile = JSON.stringify(filtered);
}

export function addToBuildingStockpile(building: BuildingState, resource: string, amount: number): void {
  const sp = getBuildingStockpile(building);
  sp[resource] = roundValue((sp[resource] || 0) + amount);
  setBuildingStockpile(building, sp);
}

export function getBuildingStockpileAmount(building: BuildingState, resource: string): number {
  return getBuildingStockpile(building)[resource] || 0;
}