import { MapSchema } from '@colyseus/schema';
import { CellState } from '../state/CellState';
import { UnitState } from '../state/UnitState';
import {
  CFG,
  getMovementCost,
  getPassableTerrain,
  type AdjacencyMap,
} from '@vantaris/shared';

const MOVEMENT_COST = getMovementCost(CFG);
const PASSABLE_TERRAIN = getPassableTerrain(CFG);

interface CellPosition {
  x: number;
  y: number;
  z: number;
}

export function findPath(
  fromCellId: string,
  toCellId: string,
  cells: MapSchema<CellState>,
  adjacencyMap: AdjacencyMap,
  unitsByCellId: Map<string, number>,
  maxUnitsPerHex: number,
  cellPositions: Record<string, [number, number, number]>,
): string[] | null {
  if (fromCellId === toCellId) return [];

  const targetCell = cells.get(toCellId);
  if (!targetCell) return null;
  if (!PASSABLE_TERRAIN.includes(targetCell.biome as any)) return null;

  const openSet = new Set<string>([fromCellId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(fromCellId, 0);
  fScore.set(fromCellId, heuristic(fromCellId, toCellId, cellPositions));

  while (openSet.size > 0) {
    let current = '';
    let lowestF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = id;
      }
    }

    if (current === toCellId) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);
    const neighbors = adjacencyMap[current] ?? [];

    for (const neighbor of neighbors) {
      const neighborCell = cells.get(neighbor);
      if (!neighborCell) continue;

      if (!PASSABLE_TERRAIN.includes(neighborCell.biome as any)) continue;

      const unitCount = unitsByCellId.get(neighbor) ?? 0;
      if (neighbor !== toCellId && unitCount >= maxUnitsPerHex) continue;

      const moveCost = MOVEMENT_COST[neighborCell.biome] ?? 1;
      if (moveCost === Infinity || moveCost <= 0) continue;

      const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + heuristic(neighbor, toCellId, cellPositions));

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  return null;
}

function heuristic(fromId: string, toId: string, positions: Record<string, [number, number, number]>): number {
  const from = positions[fromId];
  const to = positions[toId];
  if (!from || !to) return 0;

  const dx = from[0] - to[0];
  const dy = from[1] - to[1];
  const dz = from[2] - to[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function reconstructPath(cameFrom: Map<string, string>, current: string): string[] {
  const path: string[] = [current];
  let node = current;
  while (cameFrom.has(node)) {
    node = cameFrom.get(node)!;
    path.unshift(node);
  }
  return path.slice(1);
}

export function buildUnitsByCellId(units: MapSchema<UnitState>): Map<string, number> {
  const map = new Map<string, number>();
  units.forEach((unit: UnitState) => {
    const count = map.get(unit.cellId) ?? 0;
    map.set(unit.cellId, count + 1);
  });
  return map;
}