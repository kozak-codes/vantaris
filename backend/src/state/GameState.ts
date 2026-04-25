import { Schema, type, MapSchema } from '@colyseus/schema';
import { GamePhase } from '@vantaris/shared';
import { DAY_NIGHT_CYCLE_TICKS } from '@vantaris/shared/constants';
import { CellState } from './CellState';
import { PlayerState } from './PlayerState';
import { UnitState } from './UnitState';
import { CityState } from './CityState';
import { BuildingState } from './BuildingState';

export class GameState extends Schema {
  @type({ map: CellState }) cells = new MapSchema<CellState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: UnitState }) units = new MapSchema<UnitState>();
  @type({ map: CityState }) cities = new MapSchema<CityState>();
  @type({ map: BuildingState }) buildings = new MapSchema<BuildingState>();
  @type('string') phase: GamePhase = GamePhase.WAITING;
  @type('number') tick: number = 0;
  @type('number') dayNightCycleTicks: number = DAY_NIGHT_CYCLE_TICKS;

  getSunAngle(): number {
    return (this.tick / this.dayNightCycleTicks) * Math.PI * 2;
  }
}