import { TerrainType } from '@vantaris/shared';
import { CFG } from '@vantaris/shared/constants';
import { generateWorld } from './worldgen/pipeline';
import { placeRuins } from './worldgen/ruins';
import { SeededRandom } from './worldgen/rng';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function normalize(v: Vec3, len: number): Vec3 {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return { x: (v.x / mag) * len, y: (v.y / mag) * len, z: (v.z / mag) * len };
}

function midpoint(a: Vec3, b: Vec3, radius: number): Vec3 {
  return normalize({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, radius);
}

export interface ServerHexCell {
  id: string;
  center: [number, number, number];
  neighborIds: string[];
  biome: TerrainType;
  isPentagon: boolean;
  elevation: number;
  moisture: number;
  temperature: number;
  plateId: string;
  resourceType: string;
  resourceAmount: number;
  ruin: string;
  ruinRevealed: boolean;
}

function createIcosahedron(radius: number): { vertices: Vec3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const vertices = raw.map(v => normalize(vec3(v[0], v[1], v[2]), radius));
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { vertices, faces };
}

function subdivide(
  vertices: Vec3[],
  faces: [number, number, number][],
  level: number,
  radius: number,
): { vertices: Vec3[]; faces: [number, number, number][] } {
  let v = [...vertices];
  let f = [...faces];

  for (let i = 0; i < level; i++) {
    const midCache = new Map<string, number>();
    const newFaces: [number, number, number][] = [];

    const getMidpoint = (a: number, b: number): number => {
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      if (midCache.has(key)) return midCache.get(key)!;
      const mid = midpoint(v[a], v[b], radius);
      const idx = v.length;
      v.push(mid);
      midCache.set(key, idx);
      return idx;
    };

    for (const [a, b, c] of f) {
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }

    f = newFaces;
  }

  return { vertices: v, faces: f };
}

export function generateGlobe(subdivideLevel: number, worldSeed?: number): {
  cells: ServerHexCell[];
  adjacency: Map<string, string[]>;
} {
  const radius = CFG.GLOBE.radius;
  const ico = createIcosahedron(radius);
  const { vertices, faces } = subdivide(ico.vertices, ico.faces, subdivideLevel, radius);

  const cellFaceMap = new Map<number, Set<number>>();
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    for (const vi of face) {
      if (!cellFaceMap.has(vi)) cellFaceMap.set(vi, new Set());
      cellFaceMap.get(vi)!.add(fi);
    }
  }

  const seed = worldSeed ?? 42;

  const rawCells: { cellId: string; x: number; y: number; z: number; neighborIds: string[]; isPentagon: boolean }[] = [];
  const vertexToCellId = new Map<number, string>();
  const vertexIndices = Array.from(cellFaceMap.keys());

  for (const vi of vertexIndices) {
    const faceSet = cellFaceMap.get(vi)!;
    const cellId = `cell_${rawCells.length}`;
    const isPentagon = faceSet.size === 5;
    vertexToCellId.set(vi, cellId);
    rawCells.push({
      cellId,
      x: vertices[vi].x,
      y: vertices[vi].y,
      z: vertices[vi].z,
      neighborIds: [],
      isPentagon,
    });
  }

  for (let ci = 0; ci < rawCells.length; ci++) {
    const vi = vertexIndices[ci];
    const neighborSet = new Set<string>();
    const faceSet = cellFaceMap.get(vi)!;
    for (const fi of faceSet) {
      const face = faces[fi];
      for (const fvi of face) {
        const nId = vertexToCellId.get(fvi);
        if (nId && nId !== rawCells[ci].cellId) {
          neighborSet.add(nId);
        }
      }
    }
    rawCells[ci].neighborIds = Array.from(neighborSet);
  }

  const adjacency = new Map<string, string[]>();
  for (const c of rawCells) {
    adjacency.set(c.cellId, c.neighborIds);
  }

  const world = generateWorld(rawCells, adjacency, seed);

  const rng = new SeededRandom(seed + 999);
  let landCount = 0;
  for (const wc of world.cells) {
    if (wc.elevation >= 0) landCount++;
  }
  placeRuins(world.cells, rng, landCount);

  const cells: ServerHexCell[] = world.cells.map(wc => ({
    id: wc.cellId,
    center: [wc.center.x, wc.center.y, wc.center.z],
    neighborIds: wc.neighborIds,
    biome: wc.biome,
    isPentagon: wc.isPentagon,
    elevation: wc.elevation,
    moisture: wc.moisture,
    temperature: wc.temperature,
    plateId: wc.plateId,
    resourceType: wc.resourceType,
    resourceAmount: wc.resourceAmount,
    ruin: wc.ruin,
    ruinRevealed: wc.ruinRevealed,
  }));

  return { cells, adjacency };
}