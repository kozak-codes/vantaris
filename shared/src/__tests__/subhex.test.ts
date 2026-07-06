import { describe, it, expect } from 'vitest';
import { CFG } from '../CFG';
import {
  generateSubHexCoords,
  subHexCount,
  subHexIndexFromAxial,
  axialFromSubHexIndex,
  subHexNeighbors,
  constructionId,
  parseConstructionId,
  hexDistance,
  axialToPixel,
  HEX_DIRECTIONS,
  subHexSize,
  generateSubHexesWorld,
  sampleWorldTerrain,
  type AxialCoord,
} from '../subhex';
import { SubBiomeType } from '../types';

// ─── Helpers ────────────────────────────────────────

const R = CFG.SUBHEX.radius;

function makePositions(center: [number, number, number] = [3, 0, 4]): [number, number, number][] {
  const scale = 8 / R; // keep sub-hex spacing proportional
  return generateSubHexCoords(R).map((c) => [
    center[0] + c.q * 0.05 * scale,
    center[1] + c.r * 0.04 * scale,
    center[2] + c.q * 0.03 * scale,
  ]);
}

// ─── hexDistance ────────────────────────────────────

describe('hexDistance', () => {
  it('distance from origin to origin is 0', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it('distance to immediate neighbor is 1', () => {
    for (const dir of HEX_DIRECTIONS) {
      expect(hexDistance({ q: 0, r: 0 }, dir)).toBe(1);
    }
  });

  it('is symmetric', () => {
    const points = generateSubHexCoords(R);
    for (const a of points.slice(0, 20)) {
      for (const b of points.slice(0, 20)) {
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
      }
    }
  });

  it('satisfies triangle inequality', () => {
    const points = generateSubHexCoords(R);
    for (const a of points.slice(0, 10)) {
      for (const b of points.slice(0, 10)) {
        for (const c of points.slice(0, 10)) {
          expect(hexDistance(a, c)).toBeLessThanOrEqual(hexDistance(a, b) + hexDistance(b, c));
        }
      }
    }
  });

  it('known values', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: -2, r: 2 })).toBe(2);
    expect(hexDistance({ q: 1, r: 1 }, { q: -1, r: -1 })).toBe(4);
  });
});

// ─── axialToPixel ───────────────────────────────────

describe('axialToPixel', () => {
  it('origin maps to (0, 0)', () => {
    const p = axialToPixel(0, 0, 1);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('scales with size', () => {
    const p1 = axialToPixel(1, 0, 1);
    const p2 = axialToPixel(1, 0, 2);
    expect(p2.x).toBeCloseTo(p1.x * 2, 5);
    expect(p2.y).toBeCloseTo(p1.y * 2, 5);
  });

  it('flat-top layout: r=0 row has all same y', () => {
    const y0 = axialToPixel(0, 0, 1).y;
    const y1 = axialToPixel(1, 0, 1).y;
    const y2 = axialToPixel(-1, 0, 1).y;
    expect(y0).toBeCloseTo(y1, 5);
    expect(y0).toBeCloseTo(y2, 5);
  });

  it('r=1 row is offset vertically by 3/2 * size', () => {
    const y0 = axialToPixel(0, 0, 1).y;
    const y1 = axialToPixel(0, 1, 1).y;
    expect(y1 - y0).toBeCloseTo(1.5, 5);
  });
});

// ─── HEX_DIRECTIONS ─────────────────────────────────

describe('HEX_DIRECTIONS', () => {
  it('has 6 directions', () => {
    expect(HEX_DIRECTIONS.length).toBe(6);
  });

  it('all directions are unique', () => {
    const set = new Set(HEX_DIRECTIONS.map((d) => `${d.q},${d.r}`));
    expect(set.size).toBe(6);
  });

  it('all directions have distance 1 from origin', () => {
    for (const d of HEX_DIRECTIONS) {
      expect(hexDistance({ q: 0, r: 0 }, d)).toBe(1);
    }
  });

  it('sum of all directions is zero (closed loop)', () => {
    const sum = HEX_DIRECTIONS.reduce(
      (acc, d) => ({ q: acc.q + d.q, r: acc.r + d.r }),
      { q: 0, r: 0 },
    );
    expect(sum.q).toBe(0);
    expect(sum.r).toBe(0);
  });
});

// ─── subHexCount ────────────────────────────────────

describe('subHexCount', () => {
  it('R=0 → 1', () => {
    expect(subHexCount(0)).toBe(1);
  });

  it('R=1 → 7', () => {
    expect(subHexCount(1)).toBe(7);
  });

  it('R=2 → 19', () => {
    expect(subHexCount(2)).toBe(19);
  });

  it('R=8 → 217 (config value)', () => {
    expect(subHexCount(8)).toBe(217);
  });

  it('matches formula 1 + 3*R*(R+1)', () => {
    for (let radius = 0; radius <= 15; radius++) {
      expect(subHexCount(radius)).toBe(1 + 3 * radius * (radius + 1));
    }
  });

  it('matches generateSubHexCoords length for various radii', () => {
    for (let radius = 0; radius <= 12; radius++) {
      expect(generateSubHexCoords(radius).length).toBe(subHexCount(radius));
    }
  });
});

// ─── generateSubHexCoords ────────────────────────────

describe('generateSubHexCoords', () => {
  it('center is first', () => {
    const coords = generateSubHexCoords(R);
    expect(coords[0]).toEqual({ q: 0, r: 0 });
  });

  it('all coords are within radius', () => {
    const coords = generateSubHexCoords(R);
    for (const c of coords) {
      expect(hexDistance({ q: 0, r: 0 }, c)).toBeLessThanOrEqual(R);
    }
  });

  it('no duplicate coordinates', () => {
    const coords = generateSubHexCoords(R);
    const set = new Set(coords.map((c) => `${c.q},${c.r}`));
    expect(set.size).toBe(coords.length);
  });

  it('ring 1 has exactly 6 coords at distance 1', () => {
    const coords = generateSubHexCoords(R);
    const ring1 = coords.slice(1, 7);
    expect(ring1.length).toBe(6);
    for (const c of ring1) {
      expect(hexDistance({ q: 0, r: 0 }, c)).toBe(1);
    }
  });

  it('ring 2 starts at index 7 and has 12 coords', () => {
    const coords = generateSubHexCoords(R);
    const ring2 = coords.slice(7, 19);
    expect(ring2.length).toBe(12);
    for (const c of ring2) {
      expect(hexDistance({ q: 0, r: 0 }, c)).toBe(2);
    }
  });

  it('every expected coordinate exists for small radius', () => {
    const coords = generateSubHexCoords(2);
    const set = new Set(coords.map((c) => `${c.q},${c.r}`));
    // All (q, r) within distance 2
    for (let q = -2; q <= 2; q++) {
      for (let r = -2; r <= 2; r++) {
        if (hexDistance({ q: 0, r: 0 }, { q, r }) <= 2) {
          expect(set.has(`${q},${r}`)).toBe(true);
        }
      }
    }
  });

  it('R=0 produces just the center', () => {
    expect(generateSubHexCoords(0)).toEqual([{ q: 0, r: 0 }]);
  });
});

// ─── subHexIndexFromAxial ────────────────────────────

describe('subHexIndexFromAxial', () => {
  it('center → 0', () => {
    expect(subHexIndexFromAxial(0, 0, R)).toBe(0);
  });

  it('matches generateSubHexCoords order', () => {
    const coords = generateSubHexCoords(R);
    for (let i = 0; i < coords.length; i++) {
      expect(subHexIndexFromAxial(coords[i].q, coords[i].r, R)).toBe(i);
    }
  });

  it('out of range → -1', () => {
    expect(subHexIndexFromAxial(R + 1, 0, R)).toBe(-1);
    expect(subHexIndexFromAxial(0, R + 1, R)).toBe(-1);
    expect(subHexIndexFromAxial(-(R + 1), 0, R)).toBe(-1);
  });

  it('works for R=1', () => {
    expect(subHexIndexFromAxial(0, 0, 1)).toBe(0);
    expect(subHexIndexFromAxial(-1, 1, 1)).toBe(1);
    expect(subHexIndexFromAxial(0, 1, 1)).toBe(2);
    expect(subHexIndexFromAxial(1, 0, 1)).toBe(3);
    expect(subHexIndexFromAxial(1, -1, 1)).toBe(4);
    expect(subHexIndexFromAxial(0, -1, 1)).toBe(5);
    expect(subHexIndexFromAxial(-1, 0, 1)).toBe(6);
  });
});

// ─── axialFromSubHexIndex ────────────────────────────

describe('axialFromSubHexIndex', () => {
  it('index 0 → center', () => {
    expect(axialFromSubHexIndex(0, R)).toEqual({ q: 0, r: 0 });
  });

  it('last index → last coordinate', () => {
    const coords = generateSubHexCoords(R);
    const last = axialFromSubHexIndex(coords.length - 1, R);
    expect(last).toEqual(coords[coords.length - 1]);
  });

  it('matches generateSubHexCoords order', () => {
    const coords = generateSubHexCoords(R);
    for (let i = 0; i < coords.length; i++) {
      expect(axialFromSubHexIndex(i, R)).toEqual(coords[i]);
    }
  });

  it('out of range → null', () => {
    expect(axialFromSubHexIndex(-1, R)).toBeNull();
    expect(axialFromSubHexIndex(subHexCount(R), R)).toBeNull();
    expect(axialFromSubHexIndex(999, R)).toBeNull();
  });

  it('R=0: index 0 → center, index 1 → null', () => {
    expect(axialFromSubHexIndex(0, 0)).toEqual({ q: 0, r: 0 });
    expect(axialFromSubHexIndex(1, 0)).toBeNull();
  });
});

// ─── Round-trip property ────────────────────────────

describe('index ↔ axial round-trip', () => {
  it('axialFromIndex(subHexIndexFromAxial(q, r)) === (q, r)', () => {
    const coords = generateSubHexCoords(R);
    for (const c of coords) {
      const idx = subHexIndexFromAxial(c.q, c.r, R);
      const back = axialFromSubHexIndex(idx, R);
      expect(back).toEqual(c);
    }
  });

  it('subHexIndexFromAxial(axialFromIndex(i)) === i', () => {
    for (let i = 0; i < subHexCount(R); i++) {
      const c = axialFromSubHexIndex(i, R)!;
      expect(subHexIndexFromAxial(c.q, c.r, R)).toBe(i);
    }
  });

  it('round-trips for various radii', () => {
    for (let radius = 0; radius <= 8; radius++) {
      const coords = generateSubHexCoords(radius);
      for (let i = 0; i < coords.length; i++) {
        expect(axialFromSubHexIndex(i, radius)).toEqual(coords[i]);
        expect(subHexIndexFromAxial(coords[i].q, coords[i].r, radius)).toBe(i);
      }
    }
  });
});

// ─── subHexNeighbors ────────────────────────────────

describe('subHexNeighbors', () => {
  it('center has 6 neighbors', () => {
    expect(subHexNeighbors(0, R).length).toBe(6);
  });

  it('all neighbors are within bounds', () => {
    const total = subHexCount(R);
    for (let i = 0; i < total; i++) {
      for (const ni of subHexNeighbors(i, R)) {
        expect(ni).toBeGreaterThanOrEqual(0);
        expect(ni).toBeLessThan(total);
      }
    }
  });

  it('no self in neighbors', () => {
    for (let i = 0; i < subHexCount(R); i++) {
      expect(subHexNeighbors(i, R)).not.toContain(i);
    }
  });

  it('neighbor relation is symmetric (if A→B then B→A)', () => {
    const total = subHexCount(R);
    for (let i = 0; i < total; i++) {
      for (const ni of subHexNeighbors(i, R)) {
        expect(subHexNeighbors(ni, R)).toContain(i);
      }
    }
  });

  it('neighbors are at axial distance 1', () => {
    for (let i = 0; i < subHexCount(R); i++) {
      const coord = axialFromSubHexIndex(i, R)!;
      for (const ni of subHexNeighbors(i, R)) {
        const ncoord = axialFromSubHexIndex(ni, R)!;
        expect(hexDistance(coord, ncoord)).toBe(1);
      }
    }
  });

  it('interior cells have 6 neighbors', () => {
    // Cells at distance < R from center are interior
    for (let i = 0; i < subHexCount(R); i++) {
      const coord = axialFromSubHexIndex(i, R)!;
      if (hexDistance({ q: 0, r: 0 }, coord) < R) {
        expect(subHexNeighbors(i, R).length).toBe(6);
      }
    }
  });

  it('edge cells have fewer than 6 neighbors', () => {
    let foundEdge = false;
    for (let i = 0; i < subHexCount(R); i++) {
      const coord = axialFromSubHexIndex(i, R)!;
      if (hexDistance({ q: 0, r: 0 }, coord) === R) {
        expect(subHexNeighbors(i, R).length).toBeLessThanOrEqual(6);
        if (subHexNeighbors(i, R).length < 6) foundEdge = true;
      }
    }
    expect(foundEdge).toBe(true);
  });

  it('works for R=1', () => {
    // Center has 6 neighbors
    expect(subHexNeighbors(0, 1).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
    // Each edge cell has 3 neighbors
    for (let i = 1; i <= 6; i++) {
      expect(subHexNeighbors(i, 1).length).toBe(3);
    }
  });

  it('R=0: center has no neighbors', () => {
    expect(subHexNeighbors(0, 0)).toEqual([]);
  });
});

// ─── constructionId / parseConstructionId ──────────

describe('constructionId', () => {
  it('round-trips', () => {
    expect(parseConstructionId(constructionId('cell_42', 7))).toEqual({
      macroCellId: 'cell_42',
      subHexIndex: 7,
    });
  });

  it('handles large indices', () => {
    expect(parseConstructionId(constructionId('cell_0', 216))).toEqual({
      macroCellId: 'cell_0',
      subHexIndex: 216,
    });
  });

  it('handles index 0', () => {
    expect(parseConstructionId(constructionId('cell_5', 0))).toEqual({
      macroCellId: 'cell_5',
      subHexIndex: 0,
    });
  });

  it('handles cell IDs without underscores', () => {
    expect(parseConstructionId(constructionId('abc', 99))).toEqual({
      macroCellId: 'abc',
      subHexIndex: 99,
    });
  });

  it('returns null for invalid input', () => {
    expect(parseConstructionId('noColon')).toBeNull();
    expect(parseConstructionId('')).toBeNull();
  });

  it('returns null for non-numeric index', () => {
    expect(parseConstructionId('cell_42:abc')).toBeNull();
  });

  it('uses last colon as separator', () => {
    expect(parseConstructionId('cell_42:3:7')).toEqual({
      macroCellId: 'cell_42:3',
      subHexIndex: 7,
    });
  });

  it('round-trips for all valid indices', () => {
    for (let i = 0; i < subHexCount(R); i++) {
      const id = constructionId('cell_99', i);
      const parsed = parseConstructionId(id);
      expect(parsed).toEqual({ macroCellId: 'cell_99', subHexIndex: i });
    }
  });
});

// ─── subHexSize ─────────────────────────────────────

describe('subHexSize', () => {
  it('scales inversely with radius', () => {
    const s4 = subHexSize(10, 4);
    const s8 = subHexSize(10, 8);
    expect(s8).toBeLessThan(s4);
  });

  it('scales linearly with macroCircumradius', () => {
    const s1 = subHexSize(10, 8);
    const s2 = subHexSize(20, 8);
    expect(s2).toBeCloseTo(s1 * 2, 5);
  });

  it('is positive for positive inputs', () => {
    expect(subHexSize(5, 8)).toBeGreaterThan(0);
  });
});

// ─── generateSubHexesWorld (terrain) ─────────────────

describe('generateSubHexesWorld', () => {
  it('produces correct count', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    expect(cells.length).toBe(subHexCount(R));
  });

  it('is deterministic for same seed', () => {
    const pos = makePositions();
    const a = generateSubHexesWorld(pos, 42);
    const b = generateSubHexesWorld(pos, 42);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].height).toBe(b[i].height);
      expect(a[i].subBiome).toBe(b[i].subBiome);
      expect(a[i].buildable).toBe(b[i].buildable);
    }
  });

  it('different seeds produce different terrain', () => {
    const pos = makePositions();
    const a = generateSubHexesWorld(pos, 42);
    const b = generateSubHexesWorld(pos, 999);
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i].height !== b[i].height) diffs++;
    }
    expect(diffs).toBeGreaterThan(50);
  });

  it('indices match generateSubHexCoords order', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    const coords = generateSubHexCoords(R);
    for (let i = 0; i < cells.length; i++) {
      expect(cells[i].index).toBe(i);
      expect(cells[i].q).toBe(coords[i].q);
      expect(cells[i].r).toBe(coords[i].r);
    }
  });

  it('heights are within [heightMin, heightMax] range', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    const { heightMin, heightMax } = CFG.SUBHEX;
    for (const c of cells) {
      expect(c.height).toBeGreaterThanOrEqual(heightMin - 0.05);
      expect(c.height).toBeLessThanOrEqual(heightMax + 0.05);
    }
  });

  it('water and rocky sub-biomes are never buildable', () => {
    const cells = generateSubHexesWorld(makePositions([0, -CFG.GLOBE.radius, 0]), 42);
    for (const c of cells) {
      if (c.subBiome === SubBiomeType.WATER || c.subBiome === SubBiomeType.ICE || c.subBiome === SubBiomeType.ROCKY) {
        expect(c.buildable).toBe(false);
      }
    }
  });

  it('buildable cells have slope within maxBuildSlope to all neighbors', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    for (const c of cells) {
      if (!c.buildable) continue;
      for (const ni of subHexNeighbors(c.index, R)) {
        expect(Math.abs(c.height - cells[ni].height)).toBeLessThanOrEqual(
          CFG.SUBHEX.maxBuildSlope,
        );
      }
    }
  });

  it('polar positions produce cold sub-biomes', () => {
    // Position near the pole (high |y| relative to globe radius)
    const cells = generateSubHexesWorld(makePositions([0, CFG.GLOBE.radius, 0]), 42);
    const coldTypes = new Set([SubBiomeType.ICE, SubBiomeType.SNOW, SubBiomeType.TUNDRA]);
    const hasCold = cells.some((c) => coldTypes.has(c.subBiome));
    expect(hasCold).toBe(true);
  });

  it('different world positions produce different terrain', () => {
    const a = generateSubHexesWorld(makePositions([3, 0, 4]), 42);
    const b = generateSubHexesWorld(makePositions([-3, 0, -4]), 42);
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i].height !== b[i].height) diffs++;
    }
    expect(diffs).toBeGreaterThan(50);
  });

  it('each cell has all required fields', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    for (const c of cells) {
      expect(typeof c.index).toBe('number');
      expect(typeof c.q).toBe('number');
      expect(typeof c.r).toBe('number');
      expect(typeof c.height).toBe('number');
      expect(typeof c.subBiome).toBe('string');
      expect(typeof c.buildable).toBe('boolean');
    }
  });

  it('buildable flag is boolean for every cell', () => {
    const cells = generateSubHexesWorld(makePositions(), 42);
    for (const c of cells) {
      expect(typeof c.buildable).toBe('boolean');
    }
  });

  it('wider spacing produces some non-buildable cells', () => {
    const positions = generateSubHexCoords(R).map((c) => {
      const angle = Math.atan2(c.r, c.q || 1);
      const dist = hexDistance({ q: 0, r: 0 }, c);
      return [
        3 + Math.cos(angle) * dist * 1.5,
        Math.sin(angle) * dist * 1.5,
        4 + dist * 1.0,
      ] as [number, number, number];
    });
    const cells = generateSubHexesWorld(positions, 42);
    const hasNonBuildable = cells.some((c) => !c.buildable);
    expect(hasNonBuildable).toBe(true);
  });
});

// ─── sampleWorldTerrain ───────────────────────────

describe('sampleWorldTerrain', () => {
  it('is deterministic for same position + seed', () => {
    const a = sampleWorldTerrain([1, 2, 3], 42);
    const b = sampleWorldTerrain([1, 2, 3], 42);
    expect(a.height).toBe(b.height);
    expect(a.subBiome).toBe(b.subBiome);
  });

  it('different positions produce different heights', () => {
    const a = sampleWorldTerrain([1, 2, 3], 42);
    const b = sampleWorldTerrain([3, 2, 1], 42);
    expect(a.height).not.toBe(b.height);
  });

  it('different seeds produce different heights', () => {
    const a = sampleWorldTerrain([1, 2, 3], 42);
    const b = sampleWorldTerrain([1, 2, 3], 999);
    expect(a.height).not.toBe(b.height);
  });

  it('height is within configured range', () => {
    const { heightMin, heightMax } = CFG.SUBHEX;
    for (let i = 0; i < 20; i++) {
      const pos: [number, number, number] = [
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
        Math.random() * 10 - 5,
      ];
      const { height } = sampleWorldTerrain(pos, 42);
      expect(height).toBeGreaterThanOrEqual(heightMin - 0.05);
      expect(height).toBeLessThanOrEqual(heightMax + 0.05);
    }
  });

  it('polar positions have cold sub-biomes', () => {
    const { subBiome } = sampleWorldTerrain([0, CFG.GLOBE.radius, 0], 42);
    expect([SubBiomeType.ICE, SubBiomeType.SNOW, SubBiomeType.TUNDRA]).toContain(subBiome);
  });

  it('returns valid SubBiomeType', () => {
    const { subBiome } = sampleWorldTerrain([1, 1, 1], 42);
    expect(Object.values(SubBiomeType)).toContain(subBiome);
  });
});