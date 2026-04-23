import { GameState } from '../state/GameState';
import { computeVisibilityForPlayer } from './fog';
import type { AdjacencyMap } from '@vantaris/shared';

export function claimCell(state: GameState, playerId: string, cellId: string, adjacencyMap: AdjacencyMap): void {
  const cell = state.cells.get(cellId);
  if (!cell) return;
  cell.ownerId = playerId;

  const player = state.players.get(playerId);
  if (player) {
    player.territoryCellCount++;
  }

  computeVisibilityForPlayer(state, playerId, adjacencyMap);
}

export function loseCell(state: GameState, playerId: string, cellId: string, adjacencyMap: AdjacencyMap): void {
  const cell = state.cells.get(cellId);
  if (!cell) return;
  cell.ownerId = '';

  const player = state.players.get(playerId);
  if (player && player.territoryCellCount > 0) {
    player.territoryCellCount--;
  }

  computeVisibilityForPlayer(state, playerId, adjacencyMap);
}