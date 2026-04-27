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
  @type('string') stockpile: string = '{}';
  @type('string') resourcesInvested: string = '{"food":0,"material":0}';
  @type('string') deliveryTargetId: string = '';
  @type('string') specializationRecipe: string = '';
  @type('number') specializationCycles: number = 0;
  recipeTicksRemaining: number = 0;
}