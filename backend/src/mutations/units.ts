import { GameState } from '../state/GameState';
import { UnitState } from '../state/UnitState';
import {
  UnitType,
  UnitStatus,
  CFG,
  getMovementCost,
  type AdjacencyMap,
} from '@vantaris/shared';
import { createBuilding } from './buildings';
import { createCity } from './cities';

const MOVEMENT_COST = getMovementCost(CFG);

let unitIdCounter = 0;

export function spawnUnit(
  state: GameState,
  ownerId: string,
  cellId: string,
  unitType: string = 'INFANTRY',
  engineerLevel: number = 1,
): UnitState {
  const unit = new UnitState();
  unit.unitId = `unit_${unitIdCounter++}`;
  unit.ownerId = ownerId;
  unit.type = unitType;
  unit.status = UnitStatus.IDLE;
  unit.cellId = cellId;
  unit.movementTicksRemaining = 0;
  unit.movementTicksTotal = 0;
  unit.path = '[]';
  unit.claimTicksRemaining = 0;
  unit.buildTicksRemaining = 0;
  unit.engineerLevel = unitType === 'ENGINEER' ? engineerLevel : 0;

  state.units.set(unit.unitId, unit);
  return unit;
}

export function assignPath(
  state: GameState,
  unitId: string,
  path: string[],
): void {
  const unit = state.units.get(unitId);
  if (!unit) return;

  unit.path = JSON.stringify(path);
  unit.status = UnitStatus.MOVING;

  if (path.length > 0) {
    const nextCellId = path[0];
    const nextCell = state.cells.get(nextCellId);
    if (nextCell) {
      const cost = MOVEMENT_COST[nextCell.biome] ?? 10;
      unit.movementTicksRemaining = cost;
      unit.movementTicksTotal = cost;
    } else {
      unit.movementTicksRemaining = 10;
      unit.movementTicksTotal = 10;
    }
  }
}

export interface StepResult {
  arrived: boolean;
  cellId: string;
}

export function stepUnit(
  state: GameState,
  unitId: string,
  _adjacencyMap: AdjacencyMap,
): StepResult | null {
  const unit = state.units.get(unitId);
  if (!unit || unit.status !== UnitStatus.MOVING) return null;

  unit.movementTicksRemaining--;

  if (unit.movementTicksRemaining <= 0) {
    const path: string[] = JSON.parse(unit.path);

    if (path.length === 0) {
      unit.status = UnitStatus.IDLE;
      unit.path = '[]';
      unit.movementTicksTotal = 0;
      return { arrived: true, cellId: unit.cellId };
    }

    const nextCellId = path.shift()!;
    unit.cellId = nextCellId;
    unit.path = JSON.stringify(path);

    if (path.length === 0) {
      unit.status = UnitStatus.IDLE;
      unit.path = '[]';
      unit.movementTicksRemaining = 0;
      unit.movementTicksTotal = 0;
      return { arrived: true, cellId: nextCellId };
    } else {
      const nextCell = state.cells.get(path[0]);
      if (nextCell) {
        const cost = MOVEMENT_COST[nextCell.biome] ?? 10;
        unit.movementTicksRemaining = cost;
        unit.movementTicksTotal = cost;
      } else {
        unit.movementTicksRemaining = 10;
        unit.movementTicksTotal = 10;
      }
      return { arrived: false, cellId: nextCellId };
    }
  }

  return null;
}

export function startClaiming(
  state: GameState,
  unitId: string,
): void {
  const unit = state.units.get(unitId);
  if (!unit) return;

  const cell = state.cells.get(unit.cellId);
  if (cell && cell.ownerId === unit.ownerId) return;

  unit.status = UnitStatus.CLAIMING;

  if (!cell || !cell.ownerId) {
    unit.claimTicksRemaining = CFG.CLAIM.TICKS_UNCLAIMED;
  } else {
    unit.claimTicksRemaining = CFG.CLAIM.TICKS_ENEMY;
  }
}

export function completeClaim(
  state: GameState,
  cellId: string,
  newOwnerId: string,
): void {
  const cell = state.cells.get(cellId);
  if (!cell) return;

  const previousOwner = cell.ownerId;
  cell.ownerId = newOwnerId;

  const newPlayer = state.players.get(newOwnerId);
  if (newPlayer) {
    newPlayer.territoryCellCount++;
  }

  if (previousOwner && previousOwner !== newOwnerId) {
    const prevPlayer = state.players.get(previousOwner);
    if (prevPlayer && prevPlayer.territoryCellCount > 0) {
      prevPlayer.territoryCellCount--;
    }
  }

  if (cell.ruin && cell.ruinRevealed) {
    const buildingType = CFG.RUIN_TYPE_TO_BUILDING[cell.ruin] ?? 'FARM';
    cell.ruin = '';
    cell.ruinRevealed = false;
    if (buildingType === 'CITY') {
      const city = createCity(state, newOwnerId, cellId);
      if (city) city.population = CFG.CITY.POPULATION_INITIAL;
    } else {
      createBuilding(state, newOwnerId, cellId, buildingType);
    }
  }
}