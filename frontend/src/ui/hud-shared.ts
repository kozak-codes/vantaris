import { CFG, getBuildingCosts, getBuildingPlacementRules, getUnitProductionCosts } from '@vantaris/shared';

export const BUILDING_COSTS = getBuildingCosts(CFG);
export const BUILDING_PLACEMENT_RULES = getBuildingPlacementRules(CFG);
export const UNIT_PRODUCTION_COSTS = getUnitProductionCosts(CFG);

export const TIER_NAMES: Record<number, string> = {
  1: 'Settlement', 2: 'Village', 3: 'Town',
  4: 'City', 5: 'Metropolis', 6: 'Megacity',
};

export const BIOME_TRAVEL_NAMES: Record<string, string> = {
  PLAINS: 'Plains', FOREST: 'Forest', MOUNTAIN: 'Mountain',
  DESERT: 'Desert', TUNDRA: 'Tundra', OCEAN: 'Ocean', PENTAGON: 'Pentagon',
};

export const STATUS_DISPLAY: Record<string, string> = {
  IDLE: 'Idle', MOVING: 'Moving', BUILDING: 'Building', CLAIMING: 'Claiming',
};

export const BUILDING_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.keys(CFG.BUILDINGS).map(k => [k, k.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')])
);

export const RESOURCE_LABELS: Record<string, string> = Object.fromEntries(
  Object.keys(CFG.RESOURCES).map(k => [k, k.charAt(0) + k.slice(1).toLowerCase()])
);

export const RUIN_LABELS: Record<string, string> = {
  RUINED_CITY: 'Ruined City',
  RUINED_FACTORY: 'Ruined Factory',
  RUINED_PORT: 'Ruined Port',
  RUINED_BARRACKS: 'Ruined Barracks',
  COLLAPSED_MINE: 'Collapsed Mine',
  OVERGROWN_FARM: 'Overgrown Farm',
};

export const RUIN_TYPE_TO_BUILDING: Record<string, string> = CFG.RUIN_TYPE_TO_BUILDING;

export const typeLabel = (t: string) => t === 'ENGINEER' ? 'Engineer' : t === 'INFANTRY' ? 'Infantry' : t;