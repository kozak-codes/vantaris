import { Schema, type } from '@colyseus/schema';
import { FogState } from './FogState';

export class PlayerState extends Schema {
  @type('string') playerId: string = '';
  @type('string') displayName: string = '';
  @type('string') color: string = '';
  @type('number') territoryCellCount: number = 0;
  @type('number') cameraQuatX: number = 0;
  @type('number') cameraQuatY: number = 0;
  @type('number') cameraQuatZ: number = 0;
  @type('number') cameraQuatW: number = 1;
  @type('number') cameraZoom: number = 10;
  @type(FogState) fog: FogState = new FogState();
  @type('number') energyCredits: number = 0;
  @type('string') tradingTable: string = '{}';
}