import type { PlayerStateSlice, VisibleCellData, RevealedCellData, UnitData, CityData, PlayerSummary } from '@vantaris/shared';

export interface ClientState {
  myPlayerId: string;
  currentTick: number;
  visibleCells: Map<string, VisibleCellData>;
  revealedCells: Map<string, RevealedCellData>;
  units: Map<string, UnitData>;
  cities: Map<string, CityData>;
  players: Map<string, PlayerSummary>;
  selectedTileId: string | null;
  selectedUnitId: string | null;
  selectedCityId: string | null;
}

export const clientState: ClientState = {
  myPlayerId: '',
  currentTick: 0,
  visibleCells: new Map(),
  revealedCells: new Map(),
  units: new Map(),
  cities: new Map(),
  players: new Map(),
  selectedTileId: null,
  selectedUnitId: null,
  selectedCityId: null,
};

type RenderCallback = () => void;
const renderCallbacks: RenderCallback[] = [];

export function onStateUpdate(cb: RenderCallback): void {
  renderCallbacks.push(cb);
}

function notifyRenderers(): void {
  for (const cb of renderCallbacks) {
    cb();
  }
}

export function notifySelectionChanged(): void {
  validateSelections();
  notifyRenderers();
}

export function applyStateSlice(slice: PlayerStateSlice): void {
  clientState.myPlayerId = slice.myPlayerId;
  clientState.currentTick = slice.currentTick;

  clientState.visibleCells.clear();
  for (const vc of slice.visibleCells) {
    clientState.visibleCells.set(vc.cellId, vc);
  }

  clientState.revealedCells.clear();
  for (const rc of slice.revealedCells) {
    clientState.revealedCells.set(rc.cellId, rc);
  }

  clientState.units.clear();
  for (const unit of slice.units) {
    clientState.units.set(unit.unitId, unit);
  }

  clientState.cities.clear();
  for (const city of slice.cities) {
    clientState.cities.set(city.cityId, city);
  }

  clientState.players.clear();
  for (const player of slice.players) {
    clientState.players.set(player.playerId, player);
  }

  validateSelections();
  notifyRenderers();
}

function validateSelections(): void {
  if (clientState.selectedTileId) {
    const tileVisible = clientState.visibleCells.has(clientState.selectedTileId);
    const tileRevealed = clientState.revealedCells.has(clientState.selectedTileId);
    if (!tileVisible && !tileRevealed) {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
    }
  }

  if (clientState.selectedUnitId) {
    const unit = clientState.units.get(clientState.selectedUnitId);
    if (!unit || unit.cellId !== clientState.selectedTileId) {
      clientState.selectedUnitId = null;
    }
  }

  if (clientState.selectedCityId) {
    const city = clientState.cities.get(clientState.selectedCityId);
    if (!city || city.cellId !== clientState.selectedTileId) {
      clientState.selectedCityId = null;
    }
  }
}

export function clearClientState(): void {
  clientState.myPlayerId = '';
  clientState.currentTick = 0;
  clientState.visibleCells.clear();
  clientState.revealedCells.clear();
  clientState.units.clear();
  clientState.cities.clear();
  clientState.players.clear();
  clientState.selectedTileId = null;
  clientState.selectedUnitId = null;
  clientState.selectedCityId = null;
}