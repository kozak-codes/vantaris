import { FogVisibility, BiomeType } from '@vantaris/shared';
import { GameState } from '../state/GameState';
import { VISION_RANGE } from '@vantaris/shared/constants';

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

export function computeVisibilityForPlayer(state: GameState, playerId: string, visionRange: number = VISION_RANGE): void {
  const player = state.players.get(playerId);
  if (!player) return;

  const visibleCellIds = new Set<string>();

  for (const [cellId, cell] of state.cells) {
    if (cell.ownerId === playerId) {
      visibleCellIds.add(cellId);
      collectNeighbors(state, cellId, visionRange, visibleCellIds, new Set<string>([cellId]));
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

function collectNeighbors(
  state: GameState,
  cellId: string,
  remaining: number,
  result: Set<string>,
  visited: Set<string>,
): void {
  if (remaining <= 0) return;
  const cell = state.cells.get(cellId);
  if (!cell) return;

  const rawNeighbors = (cell as any)._neighbors as string[] | undefined;
  if (!rawNeighbors) return;

  for (const nId of rawNeighbors) {
    if (!visited.has(nId)) {
      visited.add(nId);
      result.add(nId);
      collectNeighbors(state, nId, remaining - 1, result, visited);
    }
  }
}

export function buildNeighborMap(state: GameState, adjacency: Map<string, string[]>): void {
  for (const [cellId] of state.cells) {
    const neighbors = adjacency.get(cellId) ?? [];
    (state.cells.get(cellId) as any)._neighbors = neighbors;
  }
}