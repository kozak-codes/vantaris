import { signal, computed, effect } from '@preact/signals';
import type { VisibleCellData, UnitData, CityData, BuildingData, PlayerSummary, PlayerResourceData } from '@vantaris/shared';

export const myPlayerId = signal<string>('');
export const myColor = signal<string>('#4488ff');
export const phase = signal<string>('');

export const selectedTileId = signal<string | null>(null);
export const selectedUnitId = signal<string | null>(null);
export const selectedCityId = signal<string | null>(null);
export const pendingCommand = signal<string | null>(null);

export const visibleCells = signal<Map<string, VisibleCellData>>(new Map());
export const units = signal<Map<string, UnitData>>(new Map());
export const cities = signal<Map<string, CityData>>(new Map());
export const buildings = signal<Map<string, BuildingData>>(new Map());
export const players = signal<Map<string, PlayerSummary>>(new Map());
export const resources = signal<PlayerResourceData>({ food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0 });

export const chatMessages = signal<{ from: string; text: string; ts: number }[]>([]);
export const chatTarget = signal<string | null>(null);

export const eliminationReason = signal<string | null>(null);

export const selectedCellData = computed(() => {
  const tileId = selectedTileId.value;
  if (!tileId) return null;
  return visibleCells.value.get(tileId) ?? null;
});

export const selectedUnit = computed(() => {
  const unitId = selectedUnitId.value;
  if (!unitId) return null;
  return units.value.get(unitId) ?? null;
});

export const selectedCity = computed(() => {
  const cityId = selectedCityId.value;
  if (!cityId) return null;
  return cities.value.get(cityId) ?? null;
});

export const isMyTurn = computed(() => phase.value === 'PLAYING');

export const unitsOnSelectedTile = computed(() => {
  const tileId = selectedTileId.value;
  if (!tileId) return [];
  const result: UnitData[] = [];
  for (const [, u] of units.value) {
    if (u.cellId === tileId) result.push(u);
  }
  return result;
});

export const buildingsOnSelectedTile = computed(() => {
  const tileId = selectedTileId.value;
  if (!tileId) return [];
  const result: BuildingData[] = [];
  for (const [, b] of buildings.value) {
    if (b.cellId === tileId) result.push(b);
  }
  return result;
});

export function selectTile(tileId: string | null) {
  selectedTileId.value = tileId;
  selectedUnitId.value = null;
  selectedCityId.value = null;
  pendingCommand.value = null;
}

export function selectUnit(unitId: string | null) {
  selectedUnitId.value = unitId;
  pendingCommand.value = null;
}

export function selectCity(cityId: string | null) {
  selectedCityId.value = cityId;
  selectedUnitId.value = null;
  pendingCommand.value = null;
}