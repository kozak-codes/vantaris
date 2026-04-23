import { Schema, type } from '@colyseus/schema';
import { FogState } from './FogState';

export class PlayerState extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('string') color: string = '';
  @type('number') territoryCellCount: number = 0;
  @type(FogState) fog: FogState = new FogState();
}