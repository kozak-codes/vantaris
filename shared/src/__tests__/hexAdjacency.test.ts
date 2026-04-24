import { describe, it, expect } from 'vitest';
import { buildAdjacencyMap } from '../hexAdjacency';

describe('buildAdjacencyMap', () => {
  it('should return empty adjacency for no cells', () => {
    const result = buildAdjacencyMap([], {});
    expect(Object.keys(result).length).toBe(0);
  });

  it('should create empty neighbor lists for isolated cells', () => {
    const cellIds = ['cell_0', 'cell_1', 'cell_2'];
    const positions: Record<string, [number, number, number]> = {
      cell_0: [5, 0, 0],
      cell_1: [-5, 0, 0],
      cell_2: [0, 5, 0],
    };
    const result = buildAdjacencyMap(cellIds, positions);
    for (const id of cellIds) {
      expect(result[id]).toBeDefined();
      expect(result[id].length).toBe(0);
    }
  });

  it('should connect cells within chord threshold', () => {
    const cellIds = ['cell_0', 'cell_1'];
    const positions: Record<string, [number, number, number]> = {
      cell_0: [0, 4.9, 1],
      cell_1: [0, 4.5, 2],
    };
    const result = buildAdjacencyMap(cellIds, positions);
    expect(result['cell_0']).toContain('cell_1');
    expect(result['cell_1']).toContain('cell_0');
  });

  it('should not connect cells beyond chord threshold', () => {
    const cellIds = ['cell_0', 'cell_1'];
    const positions: Record<string, [number, number, number]> = {
      cell_0: [5, 0, 0],
      cell_1: [0, 5, 0],
    };
    const result = buildAdjacencyMap(cellIds, positions);
    expect(result['cell_0']).not.toContain('cell_1');
    expect(result['cell_1']).not.toContain('cell_0');
  });

  it('should build symmetric adjacency', () => {
    const cellIds = ['cell_0', 'cell_1', 'cell_2'];
    const positions: Record<string, [number, number, number]> = {
      cell_0: [4.8, 0.5, 1.2],
      cell_1: [4.6, 0.8, 1.5],
      cell_2: [0, 5, 0],
    };
    const result = buildAdjacencyMap(cellIds, positions);
    if (result['cell_0'].includes('cell_1')) {
      expect(result['cell_1']).toContain('cell_0');
    }
    expect(result['cell_2'].length).toBe(0);
  });

  it('should always produce symmetric links (if A→B then B→A)', () => {
    const R = 5;
    const cellCount = 50;
    const cellIds: string[] = [];
    const positions: Record<string, [number, number, number]> = {};

    for (let i = 0; i < cellCount; i++) {
      cellIds.push(`cell_${i}`);
      const theta = Math.acos(1 - 2 * (i + 0.5) / cellCount);
      const phi = Math.PI * (1 + Math.sqrt(5)) * i;
      positions[`cell_${i}`] = [
        R * Math.sin(theta) * Math.cos(phi),
        R * Math.sin(theta) * Math.sin(phi),
        R * Math.cos(theta),
      ];
    }

    const result = buildAdjacencyMap(cellIds, positions);
    for (const id of cellIds) {
      for (const neighbor of result[id]) {
        expect(result[neighbor]).toContain(id);
      }
    }
  });
});