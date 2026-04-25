import { GameState } from '../state/GameState';
import { BuildingState } from '../state/BuildingState';
import { BuildingType, ResourceType } from '@vantaris/shared';
import {
  BUILDING_TICKS,
  BUILDING_PLACEMENT_RULES,
  BUILDING_COSTS,
  CELL_BUILDING_CAPACITY,
  PENTAGON_BUILDING_CAPACITY,
  EXTRACTOR_TYPES,
  ENGINEER_LEVEL_BUILD_RULES,
  SUPPLY_CHAIN_MAX_HOPS,
  SUPPLY_CHAIN_DISTANCE_PENALTY,
  FOOD_VALUE,
  MATERIAL_VALUE,
} from '@vantaris/shared/constants';
import type { AdjacencyMap } from '@vantaris/shared';
import { getCityStockpile, getCityStockpileAmount, consumeFromCityStockpile, setCityStockpile } from './resources';

let buildingIdCounter = 0;

export function getCellBuildingCapacity(cell: { biome: string; isPentagon: boolean }): number {
  if (cell.isPentagon) return PENTAGON_BUILDING_CAPACITY;
  return CELL_BUILDING_CAPACITY[cell.biome] ?? 0;
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
  building.stockpile = '[]';

  state.buildings.set(building.buildingId, building);
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
): boolean {
  const cell = state.cells.get(cellId);
  if (!cell) return false;
  if (cell.biome === 'OCEAN') return false;
  if (!cell.ownerId || cell.ownerId !== playerId) return false;

  if (buildingType === 'CITY' && cell.hasCity) return false;

  const allowedBiomes = BUILDING_PLACEMENT_RULES[buildingType];
  if (allowedBiomes && !allowedBiomes.includes(cell.biome)) return false;

  const allowedTypes = ENGINEER_LEVEL_BUILD_RULES[engineerLevel] ?? ENGINEER_LEVEL_BUILD_RULES[1] ?? [];
  if (!allowedTypes.includes(buildingType)) return false;

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

  const allowedTypes = ENGINEER_LEVEL_BUILD_RULES[engineerLevel] ?? ENGINEER_LEVEL_BUILD_RULES[1] ?? [];
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

export function cancelBuilding(state: GameState, buildingId: string): void {
  const building = state.buildings.get(buildingId);
  if (!building) return;
  if (building.productionTicksRemaining > 0) {
    removeBuilding(state, buildingId);
  }
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
    if (v !== 0) filtered[k] = v;
  }
  building.stockpile = JSON.stringify(filtered);
}

export function addToBuildingStockpile(building: BuildingState, resource: string, amount: number): void {
  const sp = getBuildingStockpile(building);
  sp[resource] = (sp[resource] || 0) + amount;
  setBuildingStockpile(building, sp);
}

export function getBuildingStockpileAmount(building: BuildingState, resource: string): number {
  return getBuildingStockpile(building)[resource] || 0;
}

export function payBuildingCost(
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
    deductFoodValue(city, cost.food);
  }

  if (cost.material > 0) {
    const materialAvailable = computeMaterialValue(city);
    if (materialAvailable < cost.material) return false;
    deductMaterialValue(city, cost.material);
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
    if (remaining <= 0) break;
    const available = getCityStockpileAmount(city, resource);
    const foodFromThis = available * value;
    const foodToTake = Math.min(foodFromThis, remaining);
    const unitsToTake = Math.ceil(foodToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      consumeFromCityStockpile(city, resource, actualTaken);
      remaining -= actualTaken * value;
    }
  }

  return remaining <= 0.01;
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
    if (remaining <= 0) break;
    const available = getCityStockpileAmount(city, resource);
    const matFromThis = available * value;
    const matToTake = Math.min(matFromThis, remaining);
    const unitsToTake = Math.ceil(matToTake / value);
    const actualTaken = Math.min(available, unitsToTake);
    if (actualTaken > 0) {
      consumeFromCityStockpile(city, resource, actualTaken);
      remaining -= actualTaken * value;
    }
  }

  return remaining <= 0.01;
}

function findNearestCityForPayment(
  cellId: string,
  ownerId: string,
  state: GameState,
  adjacencyMap: AdjacencyMap,
): { id: string; distance: number } | null {
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