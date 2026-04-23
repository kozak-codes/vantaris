import type { HexGrid as HexGridData } from '../types/index';
import { FogVisibility } from '../types/index';
import { FOG_CONFIG } from '../constants';

export class FogOfWar {
  private grid: HexGridData;

  constructor(grid: HexGridData) {
    this.grid = grid;
  }

  private startingCenter: number[] | null = null;

  revealStartingTerritory(): number[] {
    const allIndices = this.grid.cells.map((_, i) => i);
    const startIdx = Math.floor(Math.random() * allIndices.length);
    const visited: number[] = [startIdx];
    const queue: number[] = [startIdx];
    const target = FOG_CONFIG.revealedCellCount;

    while (visited.length < target && queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.grid.adjacency.get(current) ?? [];
      for (const n of neighbors) {
        if (!visited.includes(n)) {
          visited.push(n);
          queue.push(n);
          if (visited.length >= target) break;
        }
      }
      if (visited.length >= target) break;
    }

    for (const ci of visited) {
      this.grid.cells[ci].fog = FogVisibility.VISIBLE;
    }

    const visibleSet = new Set(visited);
    for (const ci of visibleSet) {
      const neighbors = this.grid.adjacency.get(ci) ?? [];
      for (const n of neighbors) {
        if (this.grid.cells[n].fog === FogVisibility.UNREVEALED) {
          this.grid.cells[n].fog = FogVisibility.REVEALED;
        }
      }
    }

    const avgX = visited.reduce((s, i) => s + this.grid.cells[i].center[0], 0) / visited.length;
    const avgY = visited.reduce((s, i) => s + this.grid.cells[i].center[1], 0) / visited.length;
    const avgZ = visited.reduce((s, i) => s + this.grid.cells[i].center[2], 0) / visited.length;
    this.startingCenter = [avgX, avgY, avgZ];

    return visited;
  }

  getStartingCenter(): number[] | null {
    return this.startingCenter;
  }

  expandFromCell(cellId: number): number[] {
    const newlyVisible: number[] = [];
    const cell = this.grid.cells[cellId];
    if (cell.fog !== FogVisibility.VISIBLE) return newlyVisible;

    const neighbors = this.grid.adjacency.get(cellId) ?? [];
    for (const n of neighbors) {
      const neighbor = this.grid.cells[n];
      if (neighbor.fog === FogVisibility.REVEALED || neighbor.fog === FogVisibility.UNREVEALED) {
        const prevFog = neighbor.fog;
        neighbor.fog = FogVisibility.VISIBLE;
        newlyVisible.push(n);

        const nn = this.grid.adjacency.get(n) ?? [];
        for (const nni of nn) {
          if (this.grid.cells[nni].fog === FogVisibility.UNREVEALED) {
            this.grid.cells[nni].fog = FogVisibility.REVEALED;
          }
        }
      }
    }

    return newlyVisible;
  }

  getCellInfo(cellId: number): { biome: string; fog: string; isPentagon: boolean } | null {
    const cell = this.grid.cells[cellId];
    if (!cell) return null;
    return {
      biome: cell.biome,
      fog: cell.fog,
      isPentagon: cell.isPentagon,
    };
  }
}