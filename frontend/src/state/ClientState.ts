import type { PlayerStateSlice, VisibleCellData, RevealedCellData, UnitData, CityData, PlayerSummary } from '@vantaris/shared';

export type CommandAction = 'move' | 'claim';

export interface CommandableAction {
  id: CommandAction;
  label: string;
  key: string;
  targetRequired: boolean;
}

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
  pendingCommand: CommandAction | null;
  hoveredCellId: string | null;
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
  pendingCommand: null,
  hoveredCellId: null,
};

type RenderCallback = () => void;
const renderCallbacks: RenderCallback[] = [];

type FirstSpawnCallback = (playerId: string, cityCellId: string) => void;
const firstSpawnCallbacks: FirstSpawnCallback[] = [];
let hasReceivedFirstState = false;

export function onFirstSpawn(cb: FirstSpawnCallback): void {
  firstSpawnCallbacks.push(cb);
}

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

export function getUnitActions(unitId: string): CommandableAction[] {
  const unit = clientState.units.get(unitId);
  if (!unit) return [];
  if (unit.ownerId !== clientState.myPlayerId) return [];

  const actions: CommandableAction[] = [];

  if (unit.status === 'IDLE') {
    actions.push({ id: 'move', label: 'Move To', key: '1', targetRequired: true });
    actions.push({ id: 'claim', label: 'Claim', key: '2', targetRequired: false });
  }

  return actions;
}

export function getCityActions(cityId: string): CommandableAction[] {
  const city = clientState.cities.get(cityId);
  if (!city) return [];
  if (city.ownerId !== clientState.myPlayerId) return [];

  const actions: CommandableAction[] = [];
  actions.push({ id: 'move', label: 'Queue Infantry', key: '1', targetRequired: false });
  return actions;
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

  if (!hasReceivedFirstState && clientState.cities.size > 0) {
    hasReceivedFirstState = true;
    for (const [, city] of clientState.cities) {
      if (city.ownerId === clientState.myPlayerId) {
        for (const cb of firstSpawnCallbacks) {
          cb(clientState.myPlayerId, city.cellId);
        }
        break;
      }
    }
  }
}

function validateSelections(): void {
  if (clientState.selectedTileId) {
    const tileVisible = clientState.visibleCells.has(clientState.selectedTileId);
    const tileRevealed = clientState.revealedCells.has(clientState.selectedTileId);
    if (!tileVisible && !tileRevealed) {
      clientState.selectedTileId = null;
      clientState.selectedUnitId = null;
      clientState.selectedCityId = null;
      clientState.pendingCommand = null;
    }
  }

  if (clientState.selectedUnitId) {
    const unit = clientState.units.get(clientState.selectedUnitId);
    if (!unit) {
      clientState.selectedUnitId = null;
      clientState.pendingCommand = null;
    } else if (unit.cellId !== clientState.selectedTileId) {
      clientState.selectedTileId = unit.cellId;
    }
  }

  if (clientState.selectedCityId) {
    const city = clientState.cities.get(clientState.selectedCityId);
    if (!city) {
      clientState.selectedCityId = null;
    } else if (city.cellId !== clientState.selectedTileId) {
      clientState.selectedTileId = city.cellId;
    }
  }

  if (clientState.pendingCommand) {
    if (clientState.pendingCommand === 'move') {
      if (!clientState.selectedUnitId) {
        clientState.pendingCommand = null;
      }
    } else if (clientState.pendingCommand === 'claim') {
      if (!clientState.selectedUnitId) {
        clientState.pendingCommand = null;
      }
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
  clientState.pendingCommand = null;
  clientState.hoveredCellId = null;
  hasReceivedFirstState = false;
}