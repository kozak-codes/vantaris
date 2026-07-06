import { CFG } from '@vantaris/shared';

export const TIER_NAMES: Record<number, string> = {
  1: 'Settlement', 2: 'Village', 3: 'Town',
  4: 'City', 5: 'Metropolis', 6: 'Megacity',
};

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