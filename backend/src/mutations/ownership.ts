import type { GameState } from '../state/GameState';

/**
 * Recalculate the owner of a macro hex based on construction counts.
 * The player with the most constructions in the hex owns it.
 * Ties result in no owner.
 */
export function recalcMacroOwnership(state: GameState, macroCellId: string): void {
  const counts = new Map<string, number>();
  for (const [, c] of state.constructions) {
    if (c.macroCellId === macroCellId) {
      counts.set(c.ownerId, (counts.get(c.ownerId) || 0) + 1);
    }
  }

  let bestOwner = '';
  let bestCount = 0;
  let tie = false;
  for (const [ownerId, count] of counts) {
    if (count > bestCount) {
      bestOwner = ownerId;
      bestCount = count;
      tie = false;
    } else if (count === bestCount) {
      tie = true;
    }
  }

  const cell = state.cells.get(macroCellId);
  if (cell) {
    cell.ownerId = tie || bestCount === 0 ? '' : bestOwner;
  }
}