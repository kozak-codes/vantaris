import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { getNextCityName } from './cityNames';
import { CFG } from '@vantaris/shared';
import { initCityStockpile } from './resources';

let cityIdCounter = 0;

export function createCity(
  state: GameState,
  ownerId: string,
  cellId: string,
): CityState {
  const city = new CityState();
  city.cityId = `city_${cityIdCounter++}`;
  city.ownerId = ownerId;
  city.cellId = cellId;
  city.name = getNextCityName();
  city.tier = 1;
  city.xp = 0;
  city.population = CFG.CITY.POPULATION_INITIAL;
  city.homesAvailable = CFG.CITY.HOMES_PER_CITY;

  initCityStockpile(city);

  const cell = state.cells.get(cellId);
  // Cell no longer tracks hasCity/cityId — city ownership is on the CityState.

  state.cities.set(city.cityId, city);
  return city;
}

export function awardCityXP(city: CityState, xp: number): void {
  city.xp += xp;

  for (let i = CFG.CITY.TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (city.xp >= CFG.CITY.TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
      city.tier = i + 1;
      break;
    }
  }
}