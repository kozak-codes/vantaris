import { SeededRandom, vec3Normalize, vec3Dot, greatCircleDistance } from './rng';
import { BoundaryType, TerrainType, ResourceType } from '@vantaris/shared';

export interface Plate {
  plateId: string;
  type: 'oceanic' | 'continental';
  drift: { x: number; y: number; z: number };
  seedCellId: string;
  seedPosition: { x: number; y: number; z: number };
}

export interface WorldCell {
  cellId: string;
  center: { x: number; y: number; z: number };
  plateId: string;
  plateType: 'oceanic' | 'continental';
  boundaryType: BoundaryType;
  boundaryDistance: number;
  elevation: number;
  temperature: number;
  moisture: number;
  biome: TerrainType;
  resourceType: ResourceType;
  resourceAmount: number;
  ruin: string;
  ruinRevealed: boolean;
  neighborIds: string[];
  isPentagon: boolean;
}

export interface WorldData {
  cells: WorldCell[];
  adjacency: Map<string, string[]>;
  plates: Plate[];
}

export function generateWorld(
  cellCenters: { cellId: string; x: number; y: number; z: number; neighborIds: string[]; isPentagon: boolean }[],
  adjacencyMap: Map<string, string[]>,
  seed: number,
  plateCount: number = 12,
): WorldData {
  const rng = new SeededRandom(seed);
  const cells: WorldCell[] = cellCenters.map(c => ({
    cellId: c.cellId,
    center: { x: c.x, y: c.y, z: c.z },
    plateId: '',
    plateType: 'oceanic',
    boundaryType: BoundaryType.NONE,
    boundaryDistance: 999,
    elevation: 0,
    temperature: 0,
    moisture: 0,
    biome: TerrainType.OCEAN,
    resourceType: ResourceType.NONE,
    resourceAmount: 0,
    ruin: '',
    ruinRevealed: false,
    neighborIds: c.neighborIds,
    isPentagon: c.isPentagon,
  }));

  const cellMap = new Map<string, WorldCell>();
  for (const c of cells) cellMap.set(c.cellId, c);

  const plates = assignPlates(cells, rng, plateCount);
  classifyBoundaries(cells, cellMap, plates);
  computeElevation(cells, cellMap, rng);
  computeClimate(cells, cellMap, rng);
  assignBiomes(cells);
  assignResources(cells);

  return {
    cells,
    adjacency: adjacencyMap,
    plates,
  };
}

function assignPlates(cells: WorldCell[], rng: SeededRandom, count: number): Plate[] {
  const shuffled = rng.shuffle([...cells]);
  const seeds = shuffled.slice(0, count);
  const continentalCount = Math.round(count * 0.4);

  const plates: Plate[] = seeds.map((cell, i) => {
    const type = i < continentalCount ? 'continental' : 'oceanic';
    const drift = vec3Normalize({
      x: rng.nextFloat(-1, 1),
      y: rng.nextFloat(-1, 1),
      z: rng.nextFloat(-1, 1),
    });
    return {
      plateId: `plate_${i}`,
      type,
      drift,
      seedCellId: cell.cellId,
      seedPosition: { x: cell.center.x, y: cell.center.y, z: cell.center.z },
    };
  });

  const radius = Math.sqrt(cells[0].center.x ** 2 + cells[0].center.y ** 2 + cells[0].center.z ** 2);

  for (const cell of cells) {
    let minDist = Infinity;
    let closestPlate = plates[0];
    for (const plate of plates) {
      const dist = greatCircleDistance(cell.center, plate.seedPosition, radius);
      if (dist < minDist) {
        minDist = dist;
        closestPlate = plate;
      }
    }
    cell.plateId = closestPlate.plateId;
    cell.plateType = closestPlate.type;
  }

  return plates;
}

function classifyBoundaries(cells: WorldCell[], cellMap: Map<string, WorldCell>, plates: Plate[]): void {
  const plateMap = new Map<string, Plate>();
  for (const p of plates) plateMap.set(p.plateId, p);

  for (const cell of cells) {
    let isBoundary = false;
    let closestBoundaryDist = Infinity;

    for (const nId of cell.neighborIds) {
      const neighbor = cellMap.get(nId);
      if (!neighbor) continue;
      if (neighbor.plateId !== cell.plateId) {
        isBoundary = true;
        const myPlate = plateMap.get(cell.plateId);
        const theirPlate = plateMap.get(neighbor.plateId);
        if (myPlate && theirPlate) {
          cell.boundaryType = getBoundaryType(myPlate, theirPlate, cell.center, neighbor.center);
        }
        break;
      }
    }

    if (isBoundary) {
      cell.boundaryDistance = 0;
    } else {
      const visited = new Set<string>();
      const queue: { id: string; dist: number }[] = [{ id: cell.cellId, dist: 0 }];
      visited.add(cell.cellId);
      while (queue.length > 0) {
        const { id, dist } = queue.shift()!;
        if (dist > 4) break;
        const c = cellMap.get(id);
        if (!c) continue;
        for (const nId of c.neighborIds) {
          if (visited.has(nId)) continue;
          visited.add(nId);
          const n = cellMap.get(nId);
          if (!n) continue;
          if (n.plateId !== cell.plateId) {
            cell.boundaryDistance = dist + 1;
            closestBoundaryDist = dist + 1;
            queue.length = 0;
            break;
          }
          if (dist + 1 < 4) {
            queue.push({ id: nId, dist: dist + 1 });
          }
        }
      }
      if (cell.boundaryDistance === 999) cell.boundaryDistance = 5;
    }
  }
}

function getBoundaryType(
  plateA: Plate,
  plateB: Plate,
  posA: { x: number; y: number; z: number },
  posB: { x: number; y: number; z: number },
): BoundaryType {
  const normal = vec3Normalize({
    x: posB.x - posA.x,
    y: posB.y - posA.y,
    z: posB.z - posA.z,
  });

  const relDrift = vec3Dot(normal, {
    x: plateB.drift.x - plateA.drift.x,
    y: plateB.drift.y - plateA.drift.y,
    z: plateB.drift.z - plateA.drift.z,
  });

  const isConvergent = relDrift < -0.1;
  const isDivergent = relDrift > 0.1;
  const aCont = plateA.type === 'continental';
  const bCont = plateB.type === 'continental';

    if (isConvergent) {
    if (aCont && bCont) return BoundaryType.CONVERGENT_CC;
    if (aCont || bCont) return BoundaryType.CONVERGENT_CO;
    return BoundaryType.CONVERGENT_OO;
  }
  if (isDivergent) {
    if (aCont || bCont) return BoundaryType.DIVERGENT_C;
    return BoundaryType.DIVERGENT_O;
  }
  return BoundaryType.TRANSFORM;
}

function computeElevation(cells: WorldCell[], cellMap: Map<string, WorldCell>, rng: SeededRandom): void {
  const noise = new SimplexNoise(rng.next() * 10000);

  for (const cell of cells) {
    let base: number;
    if (cell.plateType === 'oceanic') {
      base = -0.5;
    } else {
      base = 0.3;
    }

    let modifier = 0;
    const bd = cell.boundaryDistance;
    if (bd <= 2) {
      const falloff = 1 - bd * 0.4;
      switch (cell.boundaryType) {
        case 'CONVERGENT_CC': modifier = 0.6 * falloff; break;
        case 'CONVERGENT_CO': modifier = (cell.plateType === 'continental' ? 0.4 : -0.2) * falloff; break;
        case 'DIVERGENT_C': modifier = -0.3 * falloff; break;
        case 'TRANSFORM': modifier = 0.1 * falloff; break;
        case 'DIVERGENT_O': modifier = 0.05 * falloff; break;
        default: break;
      }
    }

    const nx = cell.center.x;
    const ny = cell.center.y;
    const nz = cell.center.z;
    const localNoise = noise.noise3D(nx * 0.3, ny * 0.3, nz * 0.3) * 0.15;

    cell.elevation = Math.max(-1, Math.min(1, base + modifier + localNoise));
  }
}

function computeClimate(cells: WorldCell[], cellMap: Map<string, WorldCell>, rng: SeededRandom): void {
  const radius = Math.sqrt(cells[0].center.x ** 2 + cells[0].center.y ** 2 + cells[0].center.z ** 2);
  const noise = new SimplexNoise(rng.next() * 10000);

  for (const cell of cells) {
    const y = cell.center.y;
    const latitude = Math.abs(y) / radius;
    let temp = 1.0 - 1.8 * latitude * latitude;
    temp -= 0.4 * Math.max(0, cell.elevation);
    const tempNoise = noise.noise3D(cell.center.x * 0.15, cell.center.y * 0.15, cell.center.z * 0.15) * 0.08;
    cell.temperature = Math.max(0, Math.min(1, temp + tempNoise));

    let moisture = 0.5 + noise.noise3D(cell.center.x * 0.2, cell.center.y * 0.2, cell.center.z * 0.2) * 0.25;
    moisture += (1.0 - latitude) * 0.15;
    if (latitude > 0.7) {
      moisture *= 0.5;
    }

    let upwindSteps = 0;
    let blocked = false;
    const step = { x: cell.center.x, y: cell.center.y, z: cell.center.z };
    for (let i = 0; i < 3; i++) {
      step.x += 0.15 * radius;
      let closestId = '';
      let closestDist = Infinity;
      for (const c of cells) {
        const dx = c.center.x - step.x;
        const dy = c.center.y - step.y;
        const dz = c.center.z - step.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < closestDist) { closestDist = d; closestId = c.cellId; }
      }
      const upwindCell = cellMap.get(closestId);
      if (upwindCell && upwindCell.elevation > 0.4) {
        blocked = true;
        break;
      }
      upwindSteps++;
    }
    if (blocked) moisture -= 0.3;

    cell.moisture = Math.max(0, Math.min(1, moisture));
  }
}

function assignBiomes(cells: WorldCell[]): void {
  for (const cell of cells) {
    if (cell.elevation < 0) {
      cell.biome = TerrainType.OCEAN;
      continue;
    }
    if (cell.elevation > 0.5) {
      cell.biome = TerrainType.MOUNTAIN;
      continue;
    }

    const t = cell.temperature;
    const m = cell.moisture;

    if (t < 0.3) {
      cell.biome = TerrainType.TUNDRA;
    } else if (t < 0.5) {
      cell.biome = m < 0.35 ? TerrainType.TUNDRA : m < 0.6 ? TerrainType.PLAINS : TerrainType.FOREST;
    } else if (t < 0.75) {
      cell.biome = m < 0.3 ? TerrainType.DESERT : m < 0.55 ? TerrainType.PLAINS : TerrainType.FOREST;
    } else {
      cell.biome = m < 0.3 ? TerrainType.DESERT : TerrainType.PLAINS;
    }
  }
}

function assignResources(cells: WorldCell[]): void {
  for (const cell of cells) {
    if (cell.biome === TerrainType.OCEAN) {
      cell.resourceType = ResourceType.NONE;
      cell.resourceAmount = 0;
    } else if (cell.biome === TerrainType.MOUNTAIN) {
      cell.resourceType = ResourceType.ORE;
      cell.resourceAmount = 2;
    } else if (cell.biome === TerrainType.PLAINS) {
      cell.resourceType = ResourceType.GRAIN;
      cell.resourceAmount = 2;
    } else if (cell.biome === TerrainType.FOREST) {
      cell.resourceType = ResourceType.TIMBER;
      cell.resourceAmount = 2;
    } else {
      cell.resourceType = ResourceType.NONE;
      cell.resourceAmount = 0;
    }
  }
}

class SimplexNoise {
  private perm: number[];

  constructor(seed: number) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    const rng = new SeededRandom(Math.floor(seed));
    const shuffled = rng.shuffle(p);
    this.perm = [...shuffled, ...shuffled];
  }

  noise3D(x: number, y: number, z: number): number {
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    const grad = (hash: number, x: number, y: number, z: number): number => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    return lerp(
      lerp(
        lerp(grad(this.perm[AA], x, y, z), grad(this.perm[BA], x - 1, y, z), u),
        lerp(grad(this.perm[AB], x, y - 1, z), grad(this.perm[BB], x - 1, y - 1, z), u),
        v,
      ),
      lerp(
        lerp(grad(this.perm[AA + 1], x, y, z - 1), grad(this.perm[BA + 1], x - 1, y, z - 1), u),
        lerp(grad(this.perm[AB + 1], x, y - 1, z - 1), grad(this.perm[BB + 1], x - 1, y - 1, z - 1), u),
        v,
      ),
      w,
    );
  }
}