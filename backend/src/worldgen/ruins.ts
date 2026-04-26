import { RuinType, TerrainType } from '@vantaris/shared';
import { SeededRandom } from './rng';
import type { WorldCell } from './pipeline';

export function placeRuins(cells: WorldCell[], rng: SeededRandom, totalLandCells: number): void {
  const targetRuinCount = Math.floor(totalLandCells * 0.10);
  if (targetRuinCount === 0) return;

  const hasOceanNeighbor = (cell: WorldCell, cellMap: Map<string, WorldCell>): boolean => {
    for (const nId of cell.neighborIds) {
      const n = cellMap.get(nId);
      if (n && n.biome === TerrainType.OCEAN) return true;
    }
    return false;
  };

  const nearMountain = (cell: WorldCell, cellMap: Map<string, WorldCell>): boolean => {
    for (const nId of cell.neighborIds) {
      const n = cellMap.get(nId);
      if (n && n.biome === TerrainType.MOUNTAIN) return true;
    }
    for (const nId of cell.neighborIds) {
      const n = cellMap.get(nId);
      if (!n) continue;
      for (const nnId of n.neighborIds) {
        const nn = cellMap.get(nnId);
        if (nn && nn.biome === TerrainType.MOUNTAIN) return true;
      }
    }
    return false;
  };

  const cellMap = new Map<string, WorldCell>();
  for (const c of cells) cellMap.set(c.cellId, c);

  const candidates: { cell: WorldCell; ruin: RuinType }[] = [];

  for (const cell of cells) {
    if (cell.elevation < 0) continue;

    const isCoastal = hasOceanNeighbor(cell, cellMap);
    const isNearMountain = nearMountain(cell, cellMap);

    if (cell.biome === TerrainType.PLAINS && isCoastal) {
      candidates.push({ cell, ruin: RuinType.RUINED_CITY });
    }
    if (isNearMountain && cell.biome !== TerrainType.OCEAN) {
      candidates.push({ cell, ruin: RuinType.RUINED_FACTORY });
    }
    if (isCoastal && cell.biome !== TerrainType.OCEAN) {
      candidates.push({ cell, ruin: RuinType.RUINED_PORT });
    }
    if (cell.biome === TerrainType.PLAINS) {
      candidates.push({ cell, ruin: RuinType.RUINED_BARRACKS });
    }
    if (cell.biome === TerrainType.MOUNTAIN) {
      candidates.push({ cell, ruin: RuinType.COLLAPSED_MINE });
    }
    if (cell.biome === TerrainType.PLAINS || cell.biome === TerrainType.FOREST) {
      candidates.push({ cell, ruin: RuinType.OVERGROWN_FARM });
    }
  }

  const placed = new Set<string>();
  const shuffled = rng.shuffle(candidates);
  let count = 0;

  for (const { cell, ruin } of shuffled) {
    if (count >= targetRuinCount) break;
    if (placed.has(cell.cellId)) continue;

    let tooClose = false;
    for (const nId of cell.neighborIds) {
      if (placed.has(nId)) { tooClose = true; break; }
    }
    if (tooClose) continue;

    cell.ruin = ruin;
    cell.ruinRevealed = false;
    placed.add(cell.cellId);
    count++;

    for (const nId of cell.neighborIds) {
      const n = cellMap.get(nId);
      if (n && !placed.has(n.cellId) && n.elevation >= 0 && rng.next() < 0.3) {
        const secondaryRuin = pickSecondaryRuin(n, cellMap, rng);
        if (secondaryRuin) {
          n.ruin = secondaryRuin;
          n.ruinRevealed = false;
          placed.add(n.cellId);
          count++;
        }
      }
    }
  }
}

function pickSecondaryRuin(cell: WorldCell, cellMap: Map<string, WorldCell>, rng: SeededRandom): RuinType | null {
  const options: RuinType[] = [];
  if (cell.biome === TerrainType.PLAINS) options.push(RuinType.RUINED_BARRACKS, RuinType.OVERGROWN_FARM);
  if (cell.biome === TerrainType.MOUNTAIN) options.push(RuinType.COLLAPSED_MINE);
  if (cell.biome === TerrainType.FOREST) options.push(RuinType.OVERGROWN_FARM);
  if (options.length === 0) return null;
  return options[Math.floor(rng.next() * options.length)];
}