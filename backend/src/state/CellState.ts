import { Schema, type } from '@colyseus/schema';
import { TerrainType, RuinType, ResourceType } from '@vantaris/shared';

export class CellState extends Schema {
  @type('string') cellId: string = '';
  @type('string') biome: TerrainType = TerrainType.OCEAN;
  @type('string') ownerId: string = '';
  @type('boolean') hasCity: boolean = false;
  @type('string') cityId: string = '';
  @type('number') elevation: number = 0;
  @type('number') moisture: number = 0;
  @type('number') temperature: number = 0;
  @type('string') plateId: string = '';
  @type('string') resourceType: ResourceType = ResourceType.NONE;
  @type('number') resourceAmount: number = 0;
  @type('string') ruin: string = '';
  @type('boolean') ruinRevealed: boolean = false;
  @type('boolean') isPentagon: boolean = false;
}