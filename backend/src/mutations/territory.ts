import { GameState } from '../state/GameState';
import { computeVisibilityForPlayer } from './fog';

export function claimCell(state: GameState, playerId: string, cellId: string): void {
  const cell = state.cells.get(cellId);
  if (!cell) return;
  cell.ownerId = playerId;

  const player = state.players.get(playerId);
  if (player) {
    player.territoryCellCount++;
  }

  computeVisibilityForPlayer(state, playerId);
}

export function loseCell(state: GameState, playerId: string, cellId: string): void {
  const cell = state.cells.get(cellId);
  if (!cell) return;
  cell.ownerId = '';

  const player = state.players.get(playerId);
  if (player && player.territoryCellCount > 0) {
    player.territoryCellCount--;
  }

  computeVisibilityForPlayer(state, playerId);
}