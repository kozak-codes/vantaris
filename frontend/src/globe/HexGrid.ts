import { Vector3 } from 'three';
import type { HexCell, HexGrid as HexGridData } from '../types/index';
import { FogVisibility } from '../types/index';
import { GLOBE_CONFIG } from '../constants';
import { assignBiomes } from './terrain';

function midpoint(a: Vector3, b: Vector3): Vector3 {
  return new Vector3(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    (a.z + b.z) / 2,
  ).normalize().multiplyScalar(GLOBE_CONFIG.radius);
}

function createIcosahedron(radius: number): { vertices: Vector3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: [number, number, number][] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];

  const vertices = raw.map(v => new Vector3(...v).normalize().multiplyScalar(radius));
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  return { vertices, faces };
}

function subdivide(
  vertices: Vector3[],
  faces: [number, number, number][],
  level: number,
): { vertices: Vector3[]; faces: [number, number, number][] } {
  let v = [...vertices];
  let f = [...faces];

  for (let i = 0; i < level; i++) {
    const midCache = new Map<string, number>();
    const newFaces: [number, number, number][] = [];

    const getMidpoint = (a: number, b: number): number => {
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      if (midCache.has(key)) return midCache.get(key)!;
      const mid = midpoint(v[a], v[b]);
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

function buildDualGrid(
  vertices: Vector3[],
  faces: [number, number, number][],
): HexGridData {
  const vertexFaces = new Map<number, number[]>();
  faces.forEach((face, fi) => {
    for (const vi of face) {
      if (!vertexFaces.has(vi)) vertexFaces.set(vi, []);
      vertexFaces.get(vi)!.push(fi);
    }
  });

  const edgeMap = new Map<string, [number, number]>();
  faces.forEach((face) => {
    const sorted = (a: number, b: number): string => {
      return Math.min(a, b) + ':' + Math.max(a, b);
    };
    const [a, b, c] = face;
    for (const pair of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = sorted(pair[0], pair[1]);
      if (!edgeMap.has(key)) {
        edgeMap.set(key, pair);
      }
    }
  });

  const dualVerts: [number, number, number][] = faces.map((face) => {
    const cx = (vertices[face[0]].x + vertices[face[1]].x + vertices[face[2]].x) / 3;
    const cy = (vertices[face[0]].y + vertices[face[1]].y + vertices[face[2]].y) / 3;
    const cz = (vertices[face[0]].z + vertices[face[1]].z + vertices[face[2]].z) / 3;
    const v = new Vector3(cx, cy, cz).normalize().multiplyScalar(GLOBE_CONFIG.radius);
    return [v.x, v.y, v.z] as [number, number, number];
  });

  const dualFaces: number[][] = [];
  for (const [, edge] of edgeMap) {
    const faceOf: number[] = [];
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      if ((f[0] === edge[0] || f[1] === edge[0] || f[2] === edge[0]) &&
          (f[0] === edge[1] || f[1] === edge[1] || f[2] === edge[1])) {
        faceOf.push(fi);
      }
    }
    if (faceOf.length === 2) {
      dualFaces.push(faceOf);
    }
  }

  const cellFaceMap = new Map<number, Set<number>>();
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    for (const vi of face) {
      if (!cellFaceMap.has(vi)) cellFaceMap.set(vi, new Set());
      cellFaceMap.get(vi)!.add(fi);
    }
  }

  const cells: HexCell[] = [];
  const adjacency = new Map<number, number[]>();

  let cellId = 0;
  const vertexToCell = new Map<number, number>();

  for (const [vi, faceSet] of cellFaceMap) {
    const center: [number, number, number] = [
      vertices[vi].x,
      vertices[vi].y,
      vertices[vi].z,
    ];
    const numFaces = faceSet.size;
    const isPentagon = numFaces === 5;

    const orderedFaces = orderFacesAroundVertex(vi, faceSet, faces, vertices);

    cells.push({
      id: cellId,
      center,
      vertexIds: orderedFaces,
      biome: assignBiomes(cells.length),
      fog: FogVisibility.UNREVEALED,
      isPentagon,
    });

    vertexToCell.set(vi, cellId);
    cellId++;
  }

  for (let ci = 0; ci < cells.length; ci++) {
    const neighbors: number[] = [];
    const faceIndices = cells[ci].vertexIds;
    for (const fi of faceIndices) {
      const face = faces[fi];
      for (const fvi of face) {
        const nci = vertexToCell.get(fvi);
        if (nci !== undefined && nci !== ci && !neighbors.includes(nci)) {
          neighbors.push(nci);
        }
      }
    }
    adjacency.set(ci, neighbors);
  }

  return { cells, vertices: dualVerts, adjacency };
}

function orderFacesAroundVertex(
  vi: number,
  faceSet: Set<number>,
  faces: [number, number, number][],
  vertices: Vector3[],
): number[] {
  const faceArr = Array.from(faceSet);
  if (faceArr.length <= 2) return faceArr;

  const center = vertices[vi].clone().normalize();
  let tangent1 = new Vector3(1, 0, 0);
  if (Math.abs(center.dot(tangent1)) > 0.9) {
    tangent1 = new Vector3(0, 1, 0);
  }
  tangent1 = tangent1.clone().sub(center.clone().multiplyScalar(center.dot(tangent1))).normalize();
  const tangent2 = new Vector3().crossVectors(center, tangent1).normalize();

  const faceAngles: { fi: number; angle: number }[] = [];
  for (const fi of faceArr) {
    const face = faces[fi];
    const cx = (vertices[face[0]].x + vertices[face[1]].x + vertices[face[2]].x) / 3;
    const cy = (vertices[face[0]].y + vertices[face[1]].y + vertices[face[2]].y) / 3;
    const cz = (vertices[face[0]].z + vertices[face[1]].z + vertices[face[2]].z) / 3;
    const dv = new Vector3(cx, cy, cz).normalize();
    const u = dv.dot(tangent1);
    const v = dv.dot(tangent2);
    const angle = Math.atan2(v, u);
    faceAngles.push({ fi, angle });
  }

  faceAngles.sort((a, b) => a.angle - b.angle);
  return faceAngles.map(fa => fa.fi);
}

export function generateHexGrid(): HexGridData {
  const ico = createIcosahedron(GLOBE_CONFIG.radius);
  const subdivided = subdivide(ico.vertices, ico.faces, GLOBE_CONFIG.subdivideLevel);
  return buildDualGrid(subdivided.vertices, subdivided.faces);
}