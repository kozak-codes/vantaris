import { Schema, type } from '@colyseus/schema';
import { BiomeType } from '@vantaris/shared';

export class CellState extends Schema {
  @type('string') cellId: string = '';
  @type('string') biome: BiomeType = BiomeType.Ocean;
  @type('string') ownerId: string = '';
  @type('boolean') hasCity: boolean = false;
  @type('string') cityId: string = '';
}