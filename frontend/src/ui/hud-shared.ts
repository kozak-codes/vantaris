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

export const BUILDING_DISPLAY: Record<string, string> = {
  FARM: 'Farm', MINE: 'Mine', POWER_PLANT: 'Power Plant',
  OIL_WELL: 'Oil Well', LUMBER_CAMP: 'Lumber Camp',
  FACTORY: 'Factory', CITY: 'Settlement',
};

export const RESOURCE_LABELS: Record<string, string> = {
  ORE: 'Ore', FOOD: 'Food', MATERIAL: 'Material', TIMBER: 'Timber',
  GRAIN: 'Grain', OIL: 'Oil', BREAD: 'Bread', STEEL: 'Steel',
  POWER: 'Power', LUMBER: 'Lumber',
};

export const RUIN_LABELS: Record<string, string> = {
  RUINED_CITY: 'Ruined City', RUINED_FACTORY: 'Ruined Factory',
  RUINED_PORT: 'Ruined Port', RUINED_BARRACKS: 'Ruined Barracks',
  COLLAPSED_MINE: 'Collapsed Mine', OVERGROWN_FARM: 'Overgrown Farm',
};

export const typeLabel = (t: string) => t === 'ENGINEER' ? 'Engineer' : t === 'INFANTRY' ? 'Infantry' : t;