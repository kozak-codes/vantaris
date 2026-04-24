import { describe, it, expect } from 'vitest';

function findPathSimple(
  fromCellId: string,
  toCellId: string,
  cells: Map<string, { biome: string }>,
  adjacency: Record<string, string[]>,
  passableTerrain: string[],
  movementCost: Record<string, number>,
  maxUnitsPerHex: number,
  unitsByCellId: Map<string, number>,
  cellPositions: Record<string, [number, number, number]>,
): string[] | null {
  if (fromCellId === toCellId) return [];
  const targetCell = cells.get(toCellId);
  if (!targetCell) return null;
  if (!passableTerrain.includes(targetCell.biome)) return null;

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
    const neighbors = adjacency[current] ?? [];

    for (const neighbor of neighbors) {
      const neighborCell = cells.get(neighbor);
      if (!neighborCell) continue;
      if (!passableTerrain.includes(neighborCell.biome)) continue;

      const unitCount = unitsByCellId.get(neighbor) ?? 0;
      if (neighbor !== toCellId && unitCount >= maxUnitsPerHex) continue;

      const moveCost = movementCost[neighborCell.biome] ?? 1;
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

const PASSABLE = ['PLAINS', 'FOREST', 'MOUNTAIN', 'DESERT', 'TUNDRA'];
const COST: Record<string, number> = { PLAINS: 3, DESERT: 3, FOREST: 6, MOUNTAIN: 9, TUNDRA: 6, OCEAN: Infinity };

function makeCells(data: { id: string; biome: string }[]): Map<string, { biome: string }> {
  const map = new Map<string, { biome: string }>();
  for (const c of data) map.set(c.id, { biome: c.biome });
  return map;
}

function makePositions(data: { id: string; pos: [number, number, number] }[]): Record<string, [number, number, number]> {
  const result: Record<string, [number, number, number]> = {};
  for (const c of data) result[c.id] = c.pos;
  return result;
}

describe('findPath (pure A* logic)', () => {
  it('should return empty path when source equals target', () => {
    const cells = makeCells([{ id: 'cell_0', biome: 'PLAINS' }, { id: 'cell_1', biome: 'PLAINS' }]);
    const positions = makePositions([{ id: 'cell_0', pos: [5, 0, 0] }, { id: 'cell_1', pos: [4.5, 0, 2] }]);
    const result = findPathSimple('cell_0', 'cell_0', cells, { cell_0: ['cell_1'], cell_1: ['cell_0'] }, PASSABLE, COST, 3, new Map(), positions);
    expect(result).toEqual([]);
  });

  it('should find a direct path between adjacent cells', () => {
    const cells = makeCells([{ id: 'cell_0', biome: 'PLAINS' }, { id: 'cell_1', biome: 'PLAINS' }]);
    const positions = makePositions([{ id: 'cell_0', pos: [5, 0, 0] }, { id: 'cell_1', pos: [4.5, 0, 2] }]);
    const result = findPathSimple('cell_0', 'cell_1', cells, { cell_0: ['cell_1'], cell_1: ['cell_0'] }, PASSABLE, COST, 3, new Map(), positions);
    expect(result).toEqual(['cell_1']);
  });

  it('should find a multi-step path through intermediate cells', () => {
    const adjacency: Record<string, string[]> = {
      cell_0: ['cell_1'],
      cell_1: ['cell_0', 'cell_2'],
      cell_2: ['cell_1', 'cell_3'],
      cell_3: ['cell_2'],
    };
    const cells = makeCells([
      { id: 'cell_0', biome: 'PLAINS' },
      { id: 'cell_1', biome: 'PLAINS' },
      { id: 'cell_2', biome: 'PLAINS' },
      { id: 'cell_3', biome: 'PLAINS' },
    ]);
    const positions = makePositions([
      { id: 'cell_0', pos: [5, 0, 0] },
      { id: 'cell_1', pos: [4.5, 0, 2] },
      { id: 'cell_2', pos: [3, 0, 3] },
      { id: 'cell_3', pos: [1, 0, 4.5] },
    ]);
    const result = findPathSimple('cell_0', 'cell_3', cells, adjacency, PASSABLE, COST, 3, new Map(), positions);
    expect(result).toEqual(['cell_1', 'cell_2', 'cell_3']);
  });

  it('should not pathfind through ocean', () => {
    const adjacency: Record<string, string[]> = {
      cell_0: ['cell_1'],
      cell_1: ['cell_0', 'cell_2'],
      cell_2: ['cell_1'],
    };
    const cells = makeCells([
      { id: 'cell_0', biome: 'PLAINS' },
      { id: 'cell_1', biome: 'OCEAN' },
      { id: 'cell_2', biome: 'PLAINS' },
    ]);
    const positions = makePositions([
      { id: 'cell_0', pos: [5, 0, 0] },
      { id: 'cell_1', pos: [4.5, 0, 2] },
      { id: 'cell_2', pos: [3, 0, 3] },
    ]);
    const result = findPathSimple('cell_0', 'cell_2', cells, adjacency, PASSABLE, COST, 3, new Map(), positions);
    expect(result).toBeNull();
  });

  it('should prefer cheaper terrain when multiple paths exist', () => {
    const adjacency: Record<string, string[]> = {
      cell_0: ['cell_1', 'cell_2'],
      cell_1: ['cell_0', 'cell_3'],
      cell_2: ['cell_0', 'cell_3'],
      cell_3: ['cell_1', 'cell_2'],
    };
    const cells = makeCells([
      { id: 'cell_0', biome: 'PLAINS' },
      { id: 'cell_1', biome: 'PLAINS' },
      { id: 'cell_2', biome: 'MOUNTAIN' },
      { id: 'cell_3', biome: 'PLAINS' },
    ]);
    const positions = makePositions([
      { id: 'cell_0', pos: [5, 0, 0] },
      { id: 'cell_1', pos: [4.5, 1, 1] },
      { id: 'cell_2', pos: [4.5, -1, 1] },
      { id: 'cell_3', pos: [3, 0, 3] },
    ]);
    const result = findPathSimple('cell_0', 'cell_3', cells, adjacency, PASSABLE, COST, 3, new Map(), positions);
    expect(result).not.toBeNull();
    expect(result![0]).toBe('cell_1');
  });

  it('should not shortcut through non-adjacent cells', () => {
    const adjacency: Record<string, string[]> = {
      cell_0: ['cell_1'],
      cell_1: ['cell_0', 'cell_2'],
      cell_2: ['cell_1', 'cell_3'],
      cell_3: ['cell_2'],
    };
    const cells = makeCells([
      { id: 'cell_0', biome: 'PLAINS' },
      { id: 'cell_1', biome: 'PLAINS' },
      { id: 'cell_2', biome: 'PLAINS' },
      { id: 'cell_3', biome: 'PLAINS' },
    ]);
    const positions = makePositions([
      { id: 'cell_0', pos: [5, 0, 0] },
      { id: 'cell_1', pos: [4.5, 0, 2] },
      { id: 'cell_2', pos: [3, 0, 3] },
      { id: 'cell_3', pos: [1, 0, 4.5] },
    ]);
    const result = findPathSimple('cell_0', 'cell_3', cells, adjacency, PASSABLE, COST, 3, new Map(), positions);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(3);
    expect(result).toEqual(['cell_1', 'cell_2', 'cell_3']);
  });

  it('should return null when no path exists', () => {
    const adjacency: Record<string, string[]> = {
      cell_0: ['cell_1'],
      cell_1: ['cell_0'],
      cell_2: ['cell_3'],
      cell_3: ['cell_2'],
    };
    const cells = makeCells([
      { id: 'cell_0', biome: 'PLAINS' },
      { id: 'cell_1', biome: 'PLAINS' },
      { id: 'cell_2', biome: 'PLAINS' },
      { id: 'cell_3', biome: 'PLAINS' },
    ]);
    const positions = makePositions([
      { id: 'cell_0', pos: [5, 0, 0] },
      { id: 'cell_1', pos: [4.5, 0, 2] },
      { id: 'cell_2', pos: [0, 5, 0] },
      { id: 'cell_3', pos: [0, 4.5, 2] },
    ]);
    const result = findPathSimple('cell_0', 'cell_3', cells, adjacency, PASSABLE, COST, 3, new Map(), positions);
    expect(result).toBeNull();
  });
});