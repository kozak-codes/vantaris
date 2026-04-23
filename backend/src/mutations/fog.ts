import { FogVisibility } from '@vantaris/shared';
import { GameState } from '../state/GameState';
import { TROOP_VISION_RANGE } from '@vantaris/shared/constants';
import type { AdjacencyMap } from '@vantaris/shared';
import type { PlayerStateSlice, VisibleCellData, RevealedCellData, UnitData, CityData, PlayerSummary } from '@vantaris/shared';

export function revealCellForPlayer(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  player.fog.setVisible(cellId);
}

export function snapshotAndHideCell(state: GameState, playerId: string, cellId: string): void {
  const player = state.players.get(playerId);
  if (!player) return;
  const cell = state.cells.get(cellId);
  if (!cell) return;
  const snapshot = JSON.stringify({
    ownerId: cell.ownerId || null,
    biome: cell.biome,
  });
  player.fog.setRevealed(cellId, snapshot);
}

export function computeVisibilityForPlayer(
  state: GameState,
  playerId: string,
  adjacencyMap: AdjacencyMap,
  visionRange: number = TROOP_VISION_RANGE,
): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const visibleCellIds = new Set<string>();

  for (const [cellId, cell] of state.cells) {
    if (cell.ownerId === playerId) {
      visibleCellIds.add(cellId);
      collectNeighborsInRange(cellId, visionRange, visibleCellIds, adjacencyMap);
    }
  }

  for (const [, unit] of state.units) {
    if (unit.ownerId === playerId) {
      visibleCellIds.add(unit.cellId);
      collectNeighborsInRange(unit.cellId, visionRange, visibleCellIds, adjacencyMap);
    }
  }

  const currentVisible = new Set<string>();
  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      currentVisible.add(cellId);
    }
  }

  for (const cellId of currentVisible) {
    if (!visibleCellIds.has(cellId)) {
      snapshotAndHideCell(state, playerId, cellId);
    }
  }

  for (const cellId of visibleCellIds) {
    if (!currentVisible.has(cellId)) {
      player.fog.setVisible(cellId);
    }
  }
}

function collectNeighborsInRange(
  startCellId: string,
  range: number,
  result: Set<string>,
  adjacencyMap: AdjacencyMap,
): void {
  const visited = new Set<string>([startCellId]);
  let frontier = new Set<string>([startCellId]);

  for (let i = 0; i < range; i++) {
    const nextFrontier = new Set<string>();
    for (const cellId of frontier) {
      const neighbors = adjacencyMap[cellId] ?? [];
      for (const nId of neighbors) {
        if (!visited.has(nId)) {
          visited.add(nId);
          result.add(nId);
          nextFrontier.add(nId);
        }
      }
    }
    frontier = nextFrontier;
  }
}

export function buildPlayerSlice(
  state: GameState,
  playerId: string,
): PlayerStateSlice {
  const player = state.players.get(playerId);
  if (!player) {
    return {
      myPlayerId: playerId,
      currentTick: state.tick,
      visibleCells: [],
      revealedCells: [],
      units: [],
      cities: [],
      players: [],
    };
  }

  const visibleCells: VisibleCellData[] = [];
  const revealedCells: RevealedCellData[] = [];
  const visibleCellIds = new Set<string>();

  for (const [cellId, fogValue] of player.fog.visibility) {
    if (fogValue === FogVisibility.VISIBLE) {
      const cell = state.cells.get(cellId);
      if (cell) {
        visibleCells.push({
          cellId: cell.cellId,
          biome: cell.biome,
          ownerId: cell.ownerId,
        });
        visibleCellIds.add(cellId);
      }
    } else if (fogValue === FogVisibility.REVEALED) {
      const snapshot = player.fog.getSnapshot(cellId);
      if (snapshot) {
        const data = JSON.parse(snapshot);
        revealedCells.push({
          cellId,
          lastKnownBiome: data.biome || '',
          lastKnownOwnerId: data.ownerId || '',
        });
      }
    }
  }

  const units: UnitData[] = [];
  for (const [, unit] of state.units) {
    if (visibleCellIds.has(unit.cellId)) {
      let path: string[] = [];
      try {
        path = JSON.parse(unit.path);
      } catch { /* ignore */ }

      units.push({
        unitId: unit.unitId,
        ownerId: unit.ownerId,
        type: unit.type,
        status: unit.status,
        cellId: unit.cellId,
        path,
        movementTicksRemaining: unit.movementTicksRemaining,
        movementTicksTotal: unit.movementTicksTotal,
        claimTicksRemaining: unit.claimTicksRemaining,
      });

      if (unit.status === 'MOVING') {
        for (const pathCellId of path) {
          if (visibleCellIds.has(pathCellId)) {
            const alreadyIncluded = units.some(u => u.unitId === unit.unitId);
            // Unit already included above with full path data
          }
        }
      }
    }
  }

  const cities: CityData[] = [];
  for (const [, city] of state.cities) {
    if (visibleCellIds.has(city.cellId)) {
      cities.push({
        cityId: city.cityId,
        ownerId: city.ownerId,
        cellId: city.cellId,
        tier: city.tier,
        xp: city.xp,
        population: city.population,
        producingUnit: city.producingUnit,
        productionTicksRemaining: city.productionTicksRemaining,
      });
    }
  }

  const ownerIds = new Set<string>();
  for (const vc of visibleCells) {
    if (vc.ownerId) ownerIds.add(vc.ownerId);
  }

  const players: PlayerSummary[] = [];
  for (const [pid, ps] of state.players) {
    if (pid === playerId || ownerIds.has(pid)) {
      players.push({
        playerId: ps.playerId,
        displayName: ps.displayName,
        color: ps.color,
      });
    }
  }

  return {
    myPlayerId: playerId,
    currentTick: state.tick,
    visibleCells,
    revealedCells,
    units,
    cities,
    players,
  };
}