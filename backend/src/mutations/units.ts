import { GameState } from '../state/GameState';
import { UnitState } from '../state/UnitState';
import { UnitType, UnitStatus } from '@vantaris/shared';
import { MOVEMENT_COST, CLAIM_TICKS_UNCLAIMED, CLAIM_TICKS_ENEMY } from '@vantaris/shared/constants';
import type { AdjacencyMap } from '@vantaris/shared';

let unitIdCounter = 0;

export function spawnUnit(
  state: GameState,
  ownerId: string,
  cellId: string,
): UnitState {
  const unit = new UnitState();
  unit.unitId = `unit_${unitIdCounter++}`;
  unit.ownerId = ownerId;
  unit.type = UnitType.INFANTRY;
  unit.status = UnitStatus.IDLE;
  unit.cellId = cellId;
  unit.movementTicksRemaining = 0;
  unit.movementTicksTotal = 0;
  unit.path = '[]';
  unit.claimTicksRemaining = 0;

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
    unit.claimTicksRemaining = CLAIM_TICKS_UNCLAIMED;
  } else {
    unit.claimTicksRemaining = CLAIM_TICKS_ENEMY;
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
}