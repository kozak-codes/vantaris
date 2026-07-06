import { CFG, type SubHexData, SubBiomeType } from './index';

// ─── Axial hex helpers ───────────────────────────

export interface AxialCoord {
  q: number;
  r: number;
}

const SQRT3 = Math.sqrt(3);

/** Hex distance from origin in axial coordinates. */
export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Convert axial (q, r) to pixel-space (x, y) for a hex of given size. */
export function axialToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (SQRT3 * q + (SQRT3 / 2) * r);
  const y = size * (3 / 2) * r;
  return { x, y };
}

/** The six axial neighbor directions. */
export const HEX_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// ─── Sub-hex layout within a macro hex ─────────────

/**
 * Generate the list of sub-hex axial coordinates for a hex-of-hexes layout
 * with the given radius R. Produces 1 + 3*R*(R+1) hexes.
 * Coordinates are ordered in rings outward from center, so (0,0) is index 0.
 */
export function generateSubHexCoords(radius: number): AxialCoord[] {
  const coords: AxialCoord[] = [{ q: 0, r: 0 }];
  for (let ring = 1; ring <= radius; ring++) {
    let q = -ring;
    let r = ring;
    for (let dir = 0; dir < 6; dir++) {
      for (let step = 0; step < ring; step++) {
        coords.push({ q, r });
        q += HEX_DIRECTIONS[dir].q;
        r += HEX_DIRECTIONS[dir].r;
      }
    }
  }
  return coords;
}

/** Total sub-hex count for a hex-of-hexes of given radius. */
export function subHexCount(radius: number): number {
  return 1 + 3 * radius * (radius + 1);
}

/**
 * Map (q, r) → stable array index (ring-ordered from center). Returns -1 if out of range.
 * Uses the same ring iteration as `generateSubHexCoords`.
 */
export function subHexIndexFromAxial(q: number, r: number, radius: number): number {
  if (hexDistance({ q: 0, r: 0 }, { q, r }) > radius) return -1;
  if (q === 0 && r === 0) return 0;
  const ring = hexDistance({ q: 0, r: 0 }, { q, r });
  // Hexes before this ring: 1 + 6*(1+2+...+(ring-1)) = 1 + 3*ring*(ring-1)
  const innerCount = 1 + 3 * ring * (ring - 1);
  let cq = -ring;
  let cr = ring;
  for (let i = 0; i < 6 * ring; i++) {
    if (cq === q && cr === r) return innerCount + i;
    const dir = HEX_DIRECTIONS[Math.floor(i / ring)];
    cq += dir.q;
    cr += dir.r;
  }
  return -1;
}

/** Map array index → (q, r). Returns null if out of range. */
export function axialFromSubHexIndex(index: number, radius: number): AxialCoord | null {
  const total = subHexCount(radius);
  if (index < 0 || index >= total) return null;
  if (index === 0) return { q: 0, r: 0 };
  // Find which ring: ring r starts at 1 + 3*r*(r-1), has 6*r hexes
  let ring = 1;
  let innerCount = 1;
  while (innerCount + 6 * ring <= index) {
    innerCount += 6 * ring;
    ring++;
  }
  const idxInRing = index - innerCount;
  let cq = -ring;
  let cr = ring;
  for (let i = 0; i < idxInRing; i++) {
    const dir = HEX_DIRECTIONS[Math.floor(i / ring)];
    cq += dir.q;
    cr += dir.r;
  }
  return { q: cq, r: cr };
}

// Cache of axial→index maps per radius, for fast neighbor lookups.
const indexCache = new Map<number, Map<string, number>>();

/**
 * Get the array of neighbor sub-hex indices (within the macro hex).
 */
export function subHexNeighbors(index: number, radius: number): number[] {
  const coord = axialFromSubHexIndex(index, radius);
  if (!coord) return [];
  let cache = indexCache.get(radius);
  if (!cache) {
    cache = new Map();
    const coords = generateSubHexCoords(radius);
    for (let i = 0; i < coords.length; i++) {
      cache.set(`${coords[i].q},${coords[i].r}`, i);
    }
    indexCache.set(radius, cache);
  }
  const result: number[] = [];
  for (const dir of HEX_DIRECTIONS) {
    const ni = cache.get(`${coord.q + dir.q},${coord.r + dir.r}`);
    if (ni !== undefined) result.push(ni);
  }
  return result;
}

// ─── Construction ID encoding ──────────────────────

export function constructionId(macroCellId: string, subHexIndex: number): string {
  return `${macroCellId}:${subHexIndex}`;
}

export function parseConstructionId(id: string): { macroCellId: string; subHexIndex: number } | null {
  const sep = id.lastIndexOf(':');
  if (sep < 0) return null;
  const macroCellId = id.substring(0, sep);
  const subHexIndex = parseInt(id.substring(sep + 1), 10);
  if (isNaN(subHexIndex)) return null;
  return { macroCellId, subHexIndex };
}

// ─── Sub-hex size (edge length) within a macro hex ──

/**
 * Edge length of a sub-hex that packs `radius` rings into a macro hex
 * of the given circumradius (center to vertex distance).
 *
 * For a hex-of-hexes of radius R with sub-hex size s:
 *   macro circumradius ≈ s * SQRT3 * R + s * SQRT3 / 2  (flat-top)
 * We solve for s given the macro circumradius.
 */
export function subHexSize(macroCircumradius: number, radius: number): number {
  // 1.05 overlap factor to ensure sub-hexes slightly exceed the macro hex
  // boundary, preventing visible seams between adjacent macro hexes.
  return (macroCircumradius / (SQRT3 * radius + SQRT3 / 2)) * 1.05;
}

// ─── Deterministic hash-based noise (3D world space) ──

/**
 * 3D hash-based value noise. Deterministic, continuous-ish for terrain
 * generation at arbitrary world-space positions.
 */
function hash3(x: number, y: number, z: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 374761393) | 0;
  h = Math.imul(h ^ (y | 0), 668265263) | 0;
  h = Math.imul(h ^ (z | 0), 2147483647) | 0;
  h = (h ^ (h >>> 13)) | 0;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 3D value noise with trilinear interpolation.
 * Returns [-1, 1].
 */
function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;

  const u = smoothstep(xf);
  const v = smoothstep(yf);
  const w = smoothstep(zf);

  const n000 = hash3(xi, yi, zi, seed);
  const n100 = hash3(xi + 1, yi, zi, seed);
  const n010 = hash3(xi, yi + 1, zi, seed);
  const n110 = hash3(xi + 1, yi + 1, zi, seed);
  const n001 = hash3(xi, yi, zi + 1, seed);
  const n101 = hash3(xi + 1, yi, zi + 1, seed);
  const n011 = hash3(xi, yi + 1, zi + 1, seed);
  const n111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  return lerp(
    lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
    lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
    w,
  );
}

/** Fractal Brownian motion noise in 3D. Returns [-1, 1]. */
function fbm3D(x: number, y: number, z: number, seed: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise3D(x * frequency, y * frequency, z * frequency, seed + i * 101) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / max;
}

// ─── Sub-hex terrain generation ─────────────────────

export interface MacroHexContext {
  macroCellId: string;
  /** Center of the macro hex in 3D world space (globe surface). */
  center: [number, number, number];
}

/** Sea level — heights below this are ocean (flat, no displacement). */
const SEA_LEVEL = 0.0;

/**
 * Sample terrain (height + sub-biome) at an arbitrary 3D world-space position
 * on the globe surface. Purely world-space noise — no macro hex input at all.
 *
 * Height is from multi-octave fBm noise. Ocean (height < sea level) is clamped
 * flat to sea level — no height displacement. Temperature is latitude-based.
 * Sub-biome is classified purely from height, temperature, moisture, and noise.
 */
export function sampleWorldTerrain(
  pos: [number, number, number],
  worldSeed: number,
): { height: number; subBiome: SubBiomeType } {
  const { heightMin, heightMax, heightNoiseScale, subBiomeNoiseScale } = CFG.SUBHEX;
  const [px, py, pz] = pos;

  // Height: multi-octave fBm noise in world space.
  const n = fbm3D(px * heightNoiseScale, py * heightNoiseScale, pz * heightNoiseScale, worldSeed + 7919, 5);
  // Lower-frequency continent shaping — determines where land vs ocean goes.
  const continent = fbm3D(px * 0.35, py * 0.35, pz * 0.35, worldSeed + 113, 3);
  // Bias the combined noise downward so ~40% of the surface is ocean.
  // continent ∈ [-1,1], n ∈ [-1,1]. Blend and shift.
  const combined = (continent * 0.6 + n * 0.4) - 0.3; // shift down → more ocean

  // Map [-1, 1] → [heightMin, heightMax]. Below sea level = ocean.
  let height = (combined * 0.5 + 0.5) * (heightMax - heightMin) + heightMin;

  // Ocean: clamp to sea level (flat water surface, no height displacement).
  const isOcean = height < SEA_LEVEL;
  if (isOcean) {
    height = SEA_LEVEL;
  }

  // Latitude-based temperature: equator (y ≈ ±R) is hot, poles (y ≈ 0) are cold.
  // Gentle curve so only the very poles are cold — no harsh arctic circle.
  const globeRadius = CFG.GLOBE.radius;
  const latitude = py / globeRadius; // [-1, 1]
  const temperature = 1.0 - Math.abs(latitude) * 0.5; // equator=1, poles=0.5

  // Moisture: world-space noise.
  const moistureNoise = fbm3D(
    px * subBiomeNoiseScale * 0.7,
    py * subBiomeNoiseScale * 0.7,
    pz * subBiomeNoiseScale * 0.7,
    worldSeed + 5557,
    3,
  );
  const moisture = moistureNoise * 0.5 + 0.5; // [0, 1]

  // Sub-biome classification noise.
  const sb = fbm3D(
    px * subBiomeNoiseScale,
    py * subBiomeNoiseScale,
    pz * subBiomeNoiseScale,
    worldSeed + 3571,
    3,
  );

  const subBiome = classifySubBiome(sb, height, temperature, moisture, isOcean);

  return { height, subBiome };
}

/**
 * Generate all sub-hexes for a macro hex using world-space terrain.
 */
export function generateSubHexesWorld(
  subHexPositions: [number, number, number][],
  worldSeed: number,
): SubHexData[] {
  const radius = CFG.SUBHEX.radius;
  const coords = generateSubHexCoords(radius);

  const heights: number[] = [];
  const subBiomes: SubBiomeType[] = [];

  for (let i = 0; i < coords.length; i++) {
    const { height, subBiome } = sampleWorldTerrain(subHexPositions[i], worldSeed);
    heights.push(height);
    subBiomes.push(subBiome);
  }

  const cells: SubHexData[] = coords.map((c, i) => {
    const buildable = computeBuildable(i, heights, subBiomes, radius);
    return {
      index: i,
      q: c.q,
      r: c.r,
      height: heights[i],
      subBiome: subBiomes[i],
      buildable,
    };
  });

  return cells;
}

function computeBuildable(
  index: number,
  heights: number[],
  subBiomes: SubBiomeType[],
  radius: number,
): boolean {
  if (subBiomes[index] === SubBiomeType.WATER || subBiomes[index] === SubBiomeType.ICE || subBiomes[index] === SubBiomeType.ROCKY) {
    return false;
  }
  const neighbors = subHexNeighbors(index, radius);
  for (const ni of neighbors) {
    if (Math.abs(heights[index] - heights[ni]) > CFG.SUBHEX.maxBuildSlope) {
      return false;
    }
  }
  return true;
}

function classifySubBiome(
  noiseVal: number, // [-1, 1]
  height: number,
  temperature: number,
  moisture: number,
  isOcean: boolean,
): SubBiomeType {
  // Ocean: flat water surface.
  if (isOcean) {
    return SubBiomeType.WATER;
  }

  // Beach at the shoreline.
  if (height < 0.015) {
    return SubBiomeType.BEACH;
  }

  // Only the very poles get snow — gentle temperature curve.
  if (temperature < 0.55) {
    return height > 0.25 ? SubBiomeType.SNOW : SubBiomeType.TUNDRA;
  }

  // Hot + dry: desert.
  if (temperature > 0.85 && moisture < 0.3) {
    return noiseVal > 0.3 ? SubBiomeType.CRAGS : SubBiomeType.DUNES;
  }

  // High elevation: mountains — only at significant height.
  if (height > 0.35) {
    return SubBiomeType.ROCKY;
  }

  // Forest based on moisture — most temperate land is green.
  if (moisture > 0.55) {
    return noiseVal > 0.2 ? SubBiomeType.FOREST_DENSE : SubBiomeType.FOREST_LIGHT;
  }
  if (moisture > 0.35) {
    return noiseVal > 0.2 ? SubBiomeType.FOREST_LIGHT : SubBiomeType.FLAT;
  }

  // Gentle hills only at moderate elevation.
  if (height > 0.15) return SubBiomeType.ROLLING;
  return SubBiomeType.FLAT;
}