/// <reference lib="webworker" />
import {
  CFG,
  SubBiomeType,
  generateSubHexCoords,
  generateSubHexesWorld,
  sampleWorldTerrain,
  subHexSize,
  type SubHexData,
} from '@vantaris/shared';

const SQRT3 = Math.sqrt(3);

const SUB_BIOME_COLORS: Record<SubBiomeType, number> = {
  [SubBiomeType.WATER]: 0x1a3a5a,
  [SubBiomeType.BEACH]: 0xc2b280,
  [SubBiomeType.FLAT]: 0x6a9a44,
  [SubBiomeType.ROLLING]: 0x5a8a3a,
  [SubBiomeType.HILLY]: 0x4a7a2a,
  [SubBiomeType.ROCKY]: 0x887755,
  [SubBiomeType.FOREST_DENSE]: 0x1a441a,
  [SubBiomeType.FOREST_LIGHT]: 0x3a6633,
  [SubBiomeType.DUNES]: 0xddcc88,
  [SubBiomeType.CRAGS]: 0xaa8855,
  [SubBiomeType.ICE]: 0xaaccdd,
  [SubBiomeType.SNOW]: 0xeeeeff,
  [SubBiomeType.TUNDRA]: 0x8a9a7a,
};

const SUBDIV = CFG.SUBHEX.planetSubdiv;

export interface WorkerRequest {
  cellId: string;
  center: [number, number, number];
  vertexPositions: [number, number, number][];
  worldSeed: number;
  fogged: boolean;
  unexplored: boolean;
  /** 1.0 = full terrain height, 0.0 = flat at sea level. */
  heightBlend: number;
}

export interface WorkerResponse {
  cellId: string;
  positions: Float32Array;
  colors: Float32Array;
  subHexes: SubHexData[];
  spherePositions: Float32Array; // flattened [x,y,z, x,y,z, ...]
  subSize: number;
}

// Color cache to avoid re-creating THREE.Color objects (not available in worker).
function getColor(subBiome: SubBiomeType, fogged: boolean, unexplored: boolean): [number, number, number] {
  const hex = SUB_BIOME_COLORS[subBiome] ?? 0x88aa55;
  let r = ((hex >> 16) & 0xff) / 255;
  let g = ((hex >> 8) & 0xff) / 255;
  let b = (hex & 0xff) / 255;
  if (unexplored) {
    // Very dark — barely visible terrain fading into fog.
    r *= 0.05; g *= 0.05; b *= 0.05;
  } else if (fogged) {
    // Desaturate + darken (approximation of HSL manipulation).
    const avg = (r + g + b) / 3;
    r = r * 0.3 + avg * 0.3 * 0.3;
    g = g * 0.3 + avg * 0.3 * 0.3;
    b = b * 0.3 + avg * 0.3 * 0.3;
    r *= 0.25; g *= 0.25; b *= 0.25;
    // Renormalize somewhat
    const max = Math.max(r, g, b, 0.01);
    r = r / max * 0.15; g = g / max * 0.15; b = b / max * 0.15;
  }
  return [r, g, b];
}

function sampleCell(req: WorkerRequest): WorkerResponse {
  const { cellId, center: centerArr, vertexPositions, worldSeed, fogged, unexplored, heightBlend } = req;
  const globeRadius = CFG.GLOBE.radius;

  const boundaryVerts = vertexPositions.map(p => {
    const v = { x: p[0], y: p[1], z: p[2] };
    return v;
  });
  const numBoundary = boundaryVerts.length;

  // Centroid
  let cx = 0, cy = 0, cz = 0;
  for (const v of boundaryVerts) { cx += v.x; cy += v.y; cz += v.z; }
  cx /= numBoundary; cy /= numBoundary; cz /= numBoundary;
  const clen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const centerX = (cx / clen) * globeRadius;
  const centerY = (cy / clen) * globeRadius;
  const centerZ = (cz / clen) * globeRadius;

  const posCache = new Map<string, { x: number; y: number; z: number }>();

  const samplePos = (
    key: string,
    p0x: number, p0y: number, p0z: number,
    p1x: number, p1y: number, p1z: number,
    p2x: number, p2y: number, p2z: number,
    a: number, b: number,
  ): { x: number; y: number; z: number } => {
    const cached = posCache.get(key);
    if (cached) return cached;
    const c = 1 - a - b;
    const bx = p0x * a + p1x * b + p2x * c;
    const by = p0y * a + p1y * b + p2y * c;
    const bz = p0z * a + p1z * b + p2z * c;
    const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    const sx = (bx / len) * globeRadius;
    const sy = (by / len) * globeRadius;
    const sz = (bz / len) * globeRadius;
    const { height } = sampleWorldTerrain([sx, sy, sz], worldSeed);
    const blendedHeight = height * heightBlend;
    const rlen = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
    const dx = sx / rlen, dy = sy / rlen, dz = sz / rlen;
    const result = { x: sx + dx * blendedHeight, y: sy + dy * blendedHeight, z: sz + dz * blendedHeight };
    posCache.set(key, result);
    return result;
  };

  const sampleFaceColor = (
    p0x: number, p0y: number, p0z: number,
    p1x: number, p1y: number, p1z: number,
    p2x: number, p2y: number, p2z: number,
  ): [number, number, number] => {
    const mx = (p0x + p1x + p2x) / 3;
    const my = (p0y + p1y + p2y) / 3;
    const mz = (p0z + p1z + p2z) / 3;
    const len = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
    const sx = (mx / len) * globeRadius;
    const sy = (my / len) * globeRadius;
    const sz = (mz / len) * globeRadius;
    const { subBiome } = sampleWorldTerrain([sx, sy, sz], worldSeed);
    return getColor(subBiome, fogged, unexplored);
  };

  // Count triangles: per triangle fan, SUBDIV*(SUBDIV+1)/2 * 2 - SUBDIV (diag) ≈ SUBDIV^2
  // Simpler: just use arrays and convert at end.
  const posArr: number[] = [];
  const colArr: number[] = [];

  for (let tri = 0; tri < numBoundary; tri++) {
    const v1 = boundaryVerts[tri];
    const v2 = boundaryVerts[(tri + 1) % numBoundary];

    for (let i = 0; i < SUBDIV; i++) {
      for (let j = 0; j < SUBDIV - i; j++) {
        const a0 = i / SUBDIV, b0 = j / SUBDIV;
        const a1 = (i + 1) / SUBDIV, b1 = j / SUBDIV;
        const a2 = i / SUBDIV, b2 = (j + 1) / SUBDIV;

        const p0 = samplePos(`${tri}_${i}_${j}`, centerX, centerY, centerZ, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, a0, b0);
        const p1 = samplePos(`${tri}_${i+1}_${j}`, centerX, centerY, centerZ, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, a1, b1);
        const p2 = samplePos(`${tri}_${i}_${j+1}`, centerX, centerY, centerZ, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, a2, b2);
        const fc = sampleFaceColor(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);

        posArr.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        colArr.push(fc[0], fc[1], fc[2], fc[0], fc[1], fc[2], fc[0], fc[1], fc[2]);

        if (j < SUBDIV - i - 1) {
          const a3 = (i + 1) / SUBDIV, b3 = (j + 1) / SUBDIV;
          const p3 = samplePos(`${tri}_${i+1}_${j+1}`, centerX, centerY, centerZ, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, a3, b3);
          const fc2 = sampleFaceColor(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);

          posArr.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p2.x, p2.y, p2.z);
          colArr.push(fc2[0], fc2[1], fc2[2], fc2[0], fc2[1], fc2[2], fc2[0], fc2[1], fc2[2]);
        }
      }
    }
  }

  // Sub-hex data for building placement.
  const circumradius = Math.sqrt(
    (centerX - boundaryVerts[0].x) ** 2 +
    (centerY - boundaryVerts[0].y) ** 2 +
    (centerZ - boundaryVerts[0].z) ** 2,
  );
  const subSize = subHexSize(circumradius, CFG.SUBHEX.radius);
  const coords = generateSubHexCoords(CFG.SUBHEX.radius);

  // Tangent plane basis.
  const nx = centerX / globeRadius, ny = centerY / globeRadius, nz = centerZ / globeRadius;
  let upX = 0, upY = 0, upZ = 1;
  if (Math.abs(nz) > 0.9) { upX = 1; upY = 0; upZ = 0; }
  let uX = ny * upZ - nz * upY;
  let uY = nz * upX - nx * upZ;
  let uZ = nx * upY - ny * upX;
  const uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ) || 1;
  uX /= uLen; uY /= uLen; uZ /= uLen;
  const vX = ny * uZ - nz * uY;
  const vY = nz * uX - nx * uZ;
  const vZ = nx * uY - ny * uX;

  const spherePositionsFlat: number[] = [];
  for (const coord of coords) {
    const px = subSize * (SQRT3 * coord.q + (SQRT3 / 2) * coord.r);
    const py = subSize * (3 / 2) * coord.r;
    const tx = centerX + uX * px + vX * py;
    const ty = centerY + uY * px + vY * py;
    const tz = centerZ + uZ * px + vZ * py;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    spherePositionsFlat.push(
      (tx / tLen) * globeRadius,
      (ty / tLen) * globeRadius,
      (tz / tLen) * globeRadius,
    );
  }

  const positionsArray: [number, number, number][] = [];
  for (let i = 0; i < spherePositionsFlat.length; i += 3) {
    positionsArray.push([spherePositionsFlat[i], spherePositionsFlat[i + 1], spherePositionsFlat[i + 2]]);
  }
  const subHexes = generateSubHexesWorld(positionsArray, worldSeed);

  return {
    cellId,
    positions: new Float32Array(posArr),
    colors: new Float32Array(colArr),
    subHexes,
    spherePositions: new Float32Array(spherePositionsFlat),
    subSize,
  };
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const res = sampleCell(e.data);
  self.postMessage(res, [res.positions.buffer, res.colors.buffer, res.spherePositions.buffer]);
};