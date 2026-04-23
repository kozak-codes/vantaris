import { Schema, type, MapSchema } from '@colyseus/schema';
import { GamePhase } from '@vantaris/shared';
import { CellState } from './CellState';
import { PlayerState } from './PlayerState';
import { UnitState } from './UnitState';
import { CityState } from './CityState';

export class GameState extends Schema {
  @type({ map: CellState }) cells = new MapSchema<CellState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: UnitState }) units = new MapSchema<UnitState>();
  @type({ map: CityState }) cities = new MapSchema<CityState>();
  @type('string') phase: GamePhase = GamePhase.WAITING;
  @type('number') tick: number = 0;
}