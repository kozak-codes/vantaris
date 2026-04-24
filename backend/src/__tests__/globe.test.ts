import { describe, it, expect } from 'vitest';
import { generateGlobe } from '../globe';

describe('generateGlobe', () => {
  it('should produce correct number of cells for level 3', () => {
    const { cells } = generateGlobe(3);
    expect(cells.length).toBe(642);
  });

  it('should produce correct number of cells for level 4', () => {
    const { cells } = generateGlobe(4);
    expect(cells.length).toBe(2562);
  });

  it('should produce cells with cell_ prefixed IDs', () => {
    const { cells } = generateGlobe(3);
    for (const cell of cells) {
      expect(cell.id).toMatch(/^cell_\d+$/);
    }
  });

  it('should produce adjacency map with cell_ prefixed keys', () => {
    const { adjacency } = generateGlobe(3);
    for (const [key] of adjacency) {
      expect(key).toMatch(/^cell_\d+$/);
    }
  });

  it('should produce adjacency map with cell_ prefixed neighbor IDs', () => {
    const { adjacency } = generateGlobe(3);
    for (const [, neighbors] of adjacency) {
      for (const nId of neighbors) {
        expect(nId).toMatch(/^cell_\d+$/);
      }
    }
  });

  it('should have symmetric adjacency', () => {
    const { cells, adjacency } = generateGlobe(3);
    for (const cell of cells) {
      const neighbors = adjacency.get(cell.id);
      expect(neighbors).toBeDefined();
      for (const nId of neighbors!) {
        const nNeighbors = adjacency.get(nId);
        expect(nNeighbors).toBeDefined();
        expect(nNeighbors!).toContain(cell.id);
      }
    }
  });

  it('should have exactly 6 neighbors for hex cells and 5 for pentagons', () => {
    const { cells, adjacency } = generateGlobe(3);
    let pentagonCount = 0;
    let hexCount = 0;

    for (const cell of cells) {
      const neighbors = adjacency.get(cell.id)!;
      if (cell.isPentagon) {
        expect(neighbors.length).toBe(5);
        pentagonCount++;
      } else {
        expect(neighbors.length).toBe(6);
        hexCount++;
      }
    }

    expect(pentagonCount).toBe(12);
    expect(hexCount).toBe(cells.length - 12);
  });

  it('should not have cells adjacent to themselves', () => {
    const { cells, adjacency } = generateGlobe(3);
    for (const cell of cells) {
      const neighbors = adjacency.get(cell.id)!;
      expect(neighbors).not.toContain(cell.id);
    }
  });

  it('should not have duplicate neighbors', () => {
    const { cells, adjacency } = generateGlobe(3);
    for (const cell of cells) {
      const neighbors = adjacency.get(cell.id)!;
      const unique = new Set(neighbors);
      expect(unique.size).toBe(neighbors.length);
    }
  });

  it('should produce cells on the globe surface (distance from origin ≈ radius)', () => {
    const { cells } = generateGlobe(3);
    const R = 5;
    for (const cell of cells) {
      const [x, y, z] = cell.center;
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(R, 1);
    }
  });
});