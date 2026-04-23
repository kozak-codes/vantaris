import { Schema, type, MapSchema } from '@colyseus/schema';
import { FogVisibility } from '@vantaris/shared';

export class FogState extends Schema {
  @type({ map: 'string' }) visibility = new MapSchema<string>();
  @type({ map: 'string' }) snapshots = new MapSchema<string>();

  setVisible(cellId: string): void {
    this.visibility.set(cellId, FogVisibility.VISIBLE);
    this.snapshots.delete(cellId);
  }

  setRevealed(cellId: string, snapshot: string): void {
    this.visibility.set(cellId, FogVisibility.REVEALED);
    this.snapshots.set(cellId, snapshot);
  }

  setUnrevealed(cellId: string): void {
    this.visibility.set(cellId, FogVisibility.UNREVEALED);
    this.snapshots.delete(cellId);
  }

  getVisibility(cellId: string): string | undefined {
    return this.visibility.get(cellId);
  }

  getSnapshot(cellId: string): string | undefined {
    return this.snapshots.get(cellId);
  }
}