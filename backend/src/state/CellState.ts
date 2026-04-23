import { Schema, type, MapSchema } from '@colyseus/schema';
import { BiomeType, FogVisibility } from '@vantaris/shared';

export class CellState extends Schema {
  @type('string') cellId: string = '';
  @type('string') biome: BiomeType = BiomeType.Ocean;
  @type('string') ownerId: string = '';
}