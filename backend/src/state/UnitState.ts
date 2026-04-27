import { Schema, type } from '@colyseus/schema';

export class UnitState extends Schema {
  @type('string') unitId: string = '';
  @type('string') ownerId: string = '';
  @type('string') type: string = 'INFANTRY';
  @type('string') status: string = 'IDLE';
  @type('string') cellId: string = '';
  @type('number') movementTicksRemaining: number = 0;
  @type('number') movementTicksTotal: number = 0;
  @type('string') path: string = '[]';
  @type('number') claimTicksRemaining: number = 0;
  @type('number') buildTicksRemaining: number = 0;
  @type('number') engineerLevel: number = 1;
  @type('number') buildExhaustion: number = 0;
}