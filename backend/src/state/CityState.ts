import { Schema, type } from '@colyseus/schema';

export class CityState extends Schema {
  @type('string') cityId: string = '';
  @type('string') ownerId: string = '';
  @type('string') cellId: string = '';
  @type('number') tier: number = 1;
  @type('number') xp: number = 0;
  @type('number') population: number = 0;
  @type('number') productionTicksRemaining: number = 0;
  @type('boolean') producingUnit: boolean = false;

  @type('number') energyCredits: number = 0;
  @type('string') factoryRecipe: string = '';
  @type('string') factoryXPMap: string = '{}';
}