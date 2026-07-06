import { Schema, type } from '@colyseus/schema';

export class CellState extends Schema {
  @type('string') cellId: string = '';
  @type('string') ownerId: string = '';
  @type('boolean') isPentagon: boolean = false;
}