import {
  CFG,
  generateSubHexCoords,
  generateSubHexesWorld,
  subHexSize,
  type SubHexData,
} from '@vantaris/shared';
import type { CellState } from '../state/CellState';

/**
 * Compute the 3D world-space positions of all sub-hex centers within a macro hex.
 */
export function computeSubHexPositions(
  macroCenter: [number, number, number],
): [number, number, number][] {
  const radius = CFG.SUBHEX.radius;
  const globeRadius = CFG.GLOBE.radius;
  const coords = generateSubHexCoords(radius);

  const macroCircumradius = 0.3;
  const subSize = subHexSize(macroCircumradius, radius);

  const [cx, cy, cz] = macroCenter;
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
  const nx = cx / len, ny = cy / len, nz = cz / len;

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

  const SQRT3 = Math.sqrt(3);
  const positions: [number, number, number][] = [];

  for (const coord of coords) {
    const px = subSize * (SQRT3 * coord.q + (SQRT3 / 2) * coord.r);
    const py = subSize * (3 / 2) * coord.r;
    const tx = cx + uX * px + vX * py;
    const ty = cy + uY * px + vY * py;
    const tz = cz + uZ * px + vZ * py;
    const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    positions.push([
      (tx / tLen) * globeRadius,
      (ty / tLen) * globeRadius,
      (tz / tLen) * globeRadius,
    ]);
  }

  return positions;
}

/**
 * Generate sub-hex terrain for a macro hex using world-space noise.
 */
export function generateMacroHexSubHexes(
  cell: CellState,
  cellPositions: Record<string, [number, number, number]>,
  worldSeed: number,
): SubHexData[] | null {
  const center = cellPositions[cell.cellId];
  if (!center) return null;
  const positions = computeSubHexPositions(center);
  return generateSubHexesWorld(positions, worldSeed);
}