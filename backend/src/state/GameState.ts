import { Schema, type, MapSchema } from '@colyseus/schema';
import { GamePhase, CFG } from '@vantaris/shared';
import { CellState } from './CellState';
import { PlayerState } from './PlayerState';
import { CityState } from './CityState';
import { OrbitalBodyState } from './OrbitalBodyState';

export class GameState extends Schema {
  @type({ map: CellState }) cells = new MapSchema<CellState>();
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: CityState }) cities = new MapSchema<CityState>();
  @type({ map: OrbitalBodyState }) orbitalBodies = new MapSchema<OrbitalBodyState>();
  @type('string') phase: GamePhase = GamePhase.WAITING;
  @type('number') tick: number = 0;
  @type('number') dayNightCycleTicks: number = CFG.DAY_NIGHT.CYCLE_TICKS;

  getSunAngle(): number {
    return (this.tick / this.dayNightCycleTicks) * Math.PI * 2;
  }
}