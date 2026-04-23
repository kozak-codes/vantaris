import { GameState } from '../state/GameState';
import { CityState } from '../state/CityState';
import { CITY_TROOP_PRODUCTION_TICKS, CITY_TIER_XP_THRESHOLDS } from '@vantaris/shared/constants';

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
  city.tier = 1;
  city.xp = 0;
  city.population = 0;
  city.producingUnit = false;
  city.productionTicksRemaining = CITY_TROOP_PRODUCTION_TICKS;

  const cell = state.cells.get(cellId);
  if (cell) {
    cell.hasCity = true;
    cell.cityId = city.cityId;
  }

  state.cities.set(city.cityId, city);
  return city;
}

export function tickCityProduction(city: CityState): boolean {
  if (!city.producingUnit) return false;

  city.productionTicksRemaining--;

  if (city.productionTicksRemaining <= 0) {
    city.productionTicksRemaining = CITY_TROOP_PRODUCTION_TICKS;
    return true;
  }

  return false;
}

export function awardCityXP(city: CityState, xp: number): void {
  city.xp += xp;

  for (let i = CITY_TIER_XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (city.xp >= CITY_TIER_XP_THRESHOLDS[i] && i + 1 > city.tier) {
      city.tier = i + 1;
      break;
    }
  }
}