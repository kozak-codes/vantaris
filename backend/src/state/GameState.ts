import { Schema, type, MapSchema } from '@colyseus/schema';
import { GamePhase } from '@vantaris/shared';
import { CellState } from './CellState';
import { PlayerState } from './PlayerState';

export class GameState extends Schema {
  @type({ map: CellState }) cells = new MapSchema<CellState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type('string') phase: GamePhase = GamePhase.WAITING;
  @type('number') turn: number = 0;
}