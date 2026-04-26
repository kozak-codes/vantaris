import { Schema, type } from '@colyseus/schema';

export class CityState extends Schema {
  @type('string') cityId: string = '';
  @type('string') ownerId: string = '';
  @type('string') cellId: string = '';
  @type('number') tier: number = 1;
  @type('number') xp: number = 0;
  @type('number') population: number = 10;

  @type('string') repeatQueue: string = '[]';
  @type('string') priorityQueue: string = '[]';
  @type('string') currentProduction: string = '';
  @type('number') productionTicksRemaining: number = 0;
  @type('number') productionTicksTotal: number = 0;
  @type('string') productionResourcesInvested: string = '{}';

  @type('number') energyCredits: number = 0;
  @type('string') factoryRecipe: string = '';
  @type('string') factoryXPMap: string = '{}';
  @type('number') passiveExpandCooldown: number = 0;

  @type('number') foodPerTick: number = 0;
  @type('number') energyPerTick: number = 0;
  @type('number') manpowerPerTick: number = 0;

  @type('string') stockpile: string = '[]';
  @type('string') resourceInflows: string = '[]';
  @type('number') lastInflowResetTick: number = 0;
}