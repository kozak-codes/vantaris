import { describe, it, expect, beforeEach } from 'vitest';
import { recalcMacroOwnership } from '../mutations/ownership';
import { GameState } from '../state/GameState';
import { CellState } from '../state/CellState';
import { ConstructionState } from '../state/ConstructionState';

function makeGameState(): GameState {
  const state = new GameState();
  const cell = new CellState();
  cell.cellId = 'cell_0';
  cell.ownerId = '';
  state.cells.set('cell_0', cell);
  return state;
}

function addConstruction(state: GameState, id: string, macroCellId: string, subHexIndex: number, ownerId: string): void {
  const c = new ConstructionState();
  c.id = id;
  c.macroCellId = macroCellId;
  c.subHexIndex = subHexIndex;
  c.type = 'HAB';
  c.ownerId = ownerId;
  state.constructions.set(id, c);
}

describe('recalcMacroOwnership', () => {
  it('no constructions → no owner', () => {
    const state = makeGameState();
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('');
  });

  it('single player with constructions → owns', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:5', 'cell_0', 5, 'playerA');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('playerA');
  });

  it('player with most constructions wins', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:1', 'cell_0', 1, 'playerB');
    addConstruction(state, 'cell_0:2', 'cell_0', 2, 'playerB');
    addConstruction(state, 'cell_0:3', 'cell_0', 3, 'playerB');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('playerB');
  });

  it('tie → no owner', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:1', 'cell_0', 1, 'playerB');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('');
  });

  it('only counts constructions on the given macro cell', () => {
    const state = makeGameState();
    const cell1 = new CellState();
    cell1.cellId = 'cell_1';
    cell1.ownerId = '';
    state.cells.set('cell_1', cell1);

    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_1:0', 'cell_1', 0, 'playerB');
    addConstruction(state, 'cell_1:1', 'cell_1', 1, 'playerB');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('playerA');
    expect(state.cells.get('cell_1')!.ownerId).toBe('');
  });

  it('removing construction updates ownership', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:1', 'cell_0', 1, 'playerB');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe(''); // tie

    state.constructions.delete('cell_0:1');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('playerA');
  });

  it('nonexistent macro cell → no crash', () => {
    const state = makeGameState();
    expect(() => recalcMacroOwnership(state, 'cell_999')).not.toThrow();
  });

  it('three-way tie → no owner', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:1', 'cell_0', 1, 'playerB');
    addConstruction(state, 'cell_0:2', 'cell_0', 2, 'playerC');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('');
  });

  it('2 vs 1 → player with 2 wins', () => {
    const state = makeGameState();
    addConstruction(state, 'cell_0:0', 'cell_0', 0, 'playerA');
    addConstruction(state, 'cell_0:1', 'cell_0', 1, 'playerA');
    addConstruction(state, 'cell_0:2', 'cell_0', 2, 'playerB');
    recalcMacroOwnership(state, 'cell_0');
    expect(state.cells.get('cell_0')!.ownerId).toBe('playerA');
  });
});