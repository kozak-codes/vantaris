import { Schema, type } from '@colyseus/schema';

export class BuildingState extends Schema {
  @type('string') buildingId: string = '';
  @type('string') ownerId: string = '';
  @type('string') cellId: string = '';
  @type('string') type: string = '';
  @type('number') productionTicksRemaining: number = 0;
  @type('string') recipe: string = '';
  @type('number') factoryTier: number = 1;
  @type('number') factoryXp: number = 0;
  @type('string') stockpile: string = '[]';
  recipeTicksRemaining: number = 0;
}