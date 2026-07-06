import { Schema, type } from '@colyseus/schema';

export class ConstructionState extends Schema {
  @type('string') id: string = '';        // `${macroCellId}:${subHexIndex}`
  @type('string') macroCellId: string = '';
  @type('number') subHexIndex: number = 0;
  @type('string') type: string = '';      // ConstructionType
  @type('string') ownerId: string = '';
}