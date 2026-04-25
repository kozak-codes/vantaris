import type { PlayerStateSlice, VisibleCellData, RevealedCellData, UnitData, CityData, PlayerSummary, RuinMarkerData, ChatMessage, BuildingData, PlayerResourceData } from '@vantaris/shared';
import { BUILDING_PLACEMENT_RULES, getEngineerBuildableTypes } from '@vantaris/shared/constants';

export type CommandAction = 'move' | 'claim' | 'build' | 'restore';

export interface CommandableAction {
  id: CommandAction;
  label: string;
  key: string;
  targetRequired: boolean;
}

export interface ClientState {
  myPlayerId: string;
  currentTick: number;
  sunAngle: number;
  dayNightCycleTicks: number;
  visibleCells: Map<string, VisibleCellData>;
  revealedCells: Map<string, RevealedCellData>;
  ruinMarkers: Map<string, RuinMarkerData>;
  units: Map<string, UnitData>;
  cities: Map<string, CityData>;
  buildings: Map<string, BuildingData>;
  players: Map<string, PlayerSummary>;
  resources: PlayerResourceData;
  selectedTileId: string | null;
  selectedUnitId: string | null;
  selectedCityId: string | null;
  pendingCommand: CommandAction | null;
  hoveredCellId: string | null;
  mouseClientX: number;
  mouseClientY: number;
  eliminationEvent: { playerId: string; displayName: string; color: string; eliminatedTick: number } | null;
  gameWonEvent: { playerId: string; displayName: string; color: string } | null;
  chatMessages: ChatMessage[];
  chatTab: 'global' | string;
  chatUnreadGlobal: number;
  chatUnreadDirect: Map<string, number>;
}

export const clientState: ClientState = {
  myPlayerId: '',
  currentTick: 0,
  sunAngle: 0,
  dayNightCycleTicks: 600,
  visibleCells: new Map(),
  revealedCells: new Map(),
  ruinMarkers: new Map(),
  units: new Map(),
  cities: new Map(),
  buildings: new Map(),
  players: new Map(),
  resources: { food: 0, energy: 0, manpower: 0, foodPerTick: 0, energyPerTick: 0, manpowerPerTick: 0, totalPopulation: 0, factoryCount: 0 },
  selectedTileId: null,
  selectedUnitId: null,
  selectedCityId: null,
  pendingCommand: null,
  hoveredCellId: null,
  mouseClientX: 0,
  mouseClientY: 0,
  eliminationEvent: null,
  gameWonEvent: null,
  chatMessages: [],
  chatTab: 'global' as string,
  chatUnreadGlobal: 0,
  chatUnreadDirect: new Map<string, number>(),
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

export function addChatMessage(msg: ChatMessage): void {
  clientState.chatMessages.push(msg);
  if (clientState.chatMessages.length > 100) {
    clientState.chatMessages = clientState.chatMessages.slice(-100);
  }
  const isOwn = msg.senderId === clientState.myPlayerId;
  const isDirect = msg.targetId !== null;
  if (!isOwn) {
    if (isDirect) {
      const partner = msg.senderId;
      if (clientState.chatTab !== partner) {
        clientState.chatUnreadDirect.set(partner, (clientState.chatUnreadDirect.get(partner) || 0) + 1);
      }
    } else {
      if (clientState.chatTab !== 'global') {
        clientState.chatUnreadGlobal++;
      }
    }
  }
  notifyRenderers();
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

    if (unit.type === 'ENGINEER') {
      const cellData = clientState.visibleCells.get(unit.cellId);
      if (cellData && cellData.ownerId === clientState.myPlayerId) {
        if (cellData.ruin && cellData.ruinRevealed) {
          actions.push({ id: 'restore', label: 'Restore Ruin', key: '3', targetRequired: false });
        } else {
          const allowedTypes = getEngineerBuildableTypes(unit.engineerLevel);
          const canBuildSomething = allowedTypes.some((bt: string) => {
            const allowedBiomes = BUILDING_PLACEMENT_RULES[bt];
            if (allowedBiomes && !allowedBiomes.includes(cellData.biome)) return false;
            if (bt === 'CITY') {
              let cellHasCity = false;
              for (const [, c] of clientState.cities) { if (c.cellId === unit.cellId) { cellHasCity = true; break; } }
              return !cellHasCity;
            }
            return cellData.buildings.length < cellData.buildingCapacity;
          });
          if (canBuildSomething) {
            actions.push({ id: 'build', label: 'Build', key: '3', targetRequired: false });
          }
        }
      }
    }
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
  clientState.sunAngle = slice.sunAngle ?? 0;
  clientState.dayNightCycleTicks = slice.dayNightCycleTicks ?? 600;

  clientState.visibleCells.clear();
  for (const vc of slice.visibleCells) {
    clientState.visibleCells.set(vc.cellId, vc);
  }

  clientState.revealedCells.clear();
  for (const rc of slice.revealedCells) {
    clientState.revealedCells.set(rc.cellId, rc);
  }

  clientState.ruinMarkers.clear();
  if (slice.ruinMarkers) {
    for (const rm of slice.ruinMarkers) {
      clientState.ruinMarkers.set(rm.cellId, rm);
    }
  }

  clientState.units.clear();
  for (const unit of slice.units) {
    clientState.units.set(unit.unitId, unit);
  }

  clientState.cities.clear();
  for (const city of slice.cities) {
    clientState.cities.set(city.cityId, city);
  }

  clientState.buildings.clear();
  if (slice.buildings) {
    for (const building of slice.buildings) {
      clientState.buildings.set(building.buildingId, building);
    }
  }

  clientState.players.clear();
  for (const player of slice.players) {
    clientState.players.set(player.playerId, player);
  }

  if (slice.resources) {
    clientState.resources = { ...slice.resources };
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
  clientState.sunAngle = 0;
  clientState.dayNightCycleTicks = 600;
  clientState.visibleCells.clear();
  clientState.revealedCells.clear();
  clientState.ruinMarkers.clear();
  clientState.units.clear();
  clientState.cities.clear();
  clientState.buildings.clear();
  clientState.players.clear();
  clientState.resources = { food: 0, energy: 0, manpower: 0, foodPerTick: 0, energyPerTick: 0, manpowerPerTick: 0, totalPopulation: 0, factoryCount: 0 };
  clientState.selectedTileId = null;
  clientState.selectedUnitId = null;
  clientState.selectedCityId = null;
  clientState.pendingCommand = null;
  clientState.hoveredCellId = null;
  clientState.mouseClientX = 0;
  clientState.mouseClientY = 0;
  clientState.eliminationEvent = null;
  clientState.gameWonEvent = null;
  clientState.chatMessages = [];
  clientState.chatTab = 'global';
  clientState.chatUnreadGlobal = 0;
  clientState.chatUnreadDirect.clear();
  hasReceivedFirstState = false;
}