import { TerrainType } from '../types/index';
import { CFG } from '@vantaris/shared/constants';

let _seed = 42;

function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}

export function resetBiomeSeed(seed: number): void {
  _seed = seed;
}

export function assignBiomes(cellIndex: number): TerrainType {
  const totalWeight = (Object.values(CFG.TERRAIN) as { weight: number }[]).reduce((s, b) => s + b.weight, 0);
  let r = seededRandom() * totalWeight;
  for (const [key, config] of Object.entries(CFG.TERRAIN)) {
    r -= config.weight;
    if (r <= 0) return key as TerrainType;
  }
  return TerrainType.OCEAN;
}