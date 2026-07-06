import { Schema, type } from '@colyseus/schema';

export class CellState extends Schema {
  @type('string') cellId: string = '';
  @type('string') ownerId: string = '';
  @type('boolean') hasCity: boolean = false;
  @type('string') cityId: string = '';
  @type('string') ruin: string = '';
  @type('boolean') ruinRevealed: boolean = false;
  @type('boolean') isPentagon: boolean = false;
}