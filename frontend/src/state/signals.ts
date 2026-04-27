import { signal, computed } from '@preact/signals';
import type { VisibleCellData, RevealedCellData, UnitData, CityData, BuildingData, PlayerSummary, PlayerResourceData, ChatMessage } from '@vantaris/shared';
import { clientState, notifySelectionChanged } from './ClientState';

export const myPlayerId = signal<string>('');
export const myColor = signal<string>('#4488ff');
export const phase = signal<string>('');
export const currentTick = signal<number>(0);
export const sunAngle = signal<number>(0);
export const dayNightCycleTicks = signal<number>(600);

export const selectedTileId = signal<string | null>(null);
export const selectedUnitId = signal<string | null>(null);
export const selectedCityId = signal<string | null>(null);
export const pendingCommand = signal<string | null>(null);
export const hoveredCellId = signal<string | null>(null);
export const mouseClientX = signal<number>(0);
export const mouseClientY = signal<number>(0);

export const visibleCells = signal<Map<string, VisibleCellData>>(new Map());
export const revealedCells = signal<Map<string, RevealedCellData>>(new Map());
export const ruinMarkers = signal<Set<string>>(new Set());
export const units = signal<Map<string, UnitData>>(new Map());
export const cities = signal<Map<string, CityData>>(new Map());
export const buildings = signal<Map<string, BuildingData>>(new Map());
export const players = signal<Map<string, PlayerSummary>>(new Map());
export const resources = signal<PlayerResourceData>({ food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0 });

export const eliminationEvent = signal<{ color: string; displayName: string; eliminatedTick: number } | null>(null);
export const gameWonEvent = signal<{ color: string; displayName: string } | null>(null);

export const chatMessages = signal<ChatMessage[]>([]);
export const chatTab = signal<string>('global');
export const chatUnreadGlobal = signal<number>(0);
export const chatUnreadDirect = signal<Map<string, number>>(new Map());

export const connected = signal<boolean>(false);
export const lastTickTime = signal<number>(0);
export const selectedBuildingId = signal<string | null>(null);

export const selectedCellData = computed(() => {
  const tileId = selectedTileId.value;
  if (!tileId) return null;
  return visibleCells.value.get(tileId) ?? null;
});

export const selectedRevealedData = computed(() => {
  const tileId = selectedTileId.value;
  if (!tileId) return null;
  return revealedCells.value.get(tileId) ?? null;
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

export const hoveredCellData = computed(() => {
  const id = hoveredCellId.value;
  if (!id) return null;
  return visibleCells.value.get(id) ?? null;
});

export const hoveredRevealedData = computed(() => {
  const id = hoveredCellId.value;
  if (!id) return null;
  return revealedCells.value.get(id) ?? null;
});

export const myUnitCount = computed(() => {
  const pid = myPlayerId.value;
  if (!pid) return 0;
  let count = 0;
  for (const [, u] of units.value) {
    if (u.ownerId === pid) count++;
  }
  return count;
});

export const sortedPlayers = computed(() => {
  const result: { playerId: string; displayName: string; color: string; alive: boolean; territoryCount: number; unitCount: number; cityCount: number }[] = [];
  for (const [, p] of players.value) {
    result.push({
      playerId: p.playerId,
      displayName: p.displayName,
      color: p.color,
      alive: p.alive,
      territoryCount: p.territoryCount,
      unitCount: p.unitCount,
      cityCount: p.cityCount,
    });
  }
  result.sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.territoryCount - a.territoryCount;
  });
  return result;
});

export function selectTile(tileId: string | null) {
  clientState.selectedTileId = tileId;
  clientState.selectedUnitId = null;
  clientState.selectedCityId = null;
  clientState.pendingCommand = null;
  selectedBuildingId.value = null;
  notifySelectionChanged();
}

export function selectUnit(unitId: string | null) {
  clientState.selectedUnitId = unitId;
  if (unitId) clientState.pendingCommand = null;
  selectedBuildingId.value = null;
  notifySelectionChanged();
}

export function selectCity(cityId: string | null) {
  clientState.selectedCityId = cityId;
  clientState.selectedUnitId = null;
  clientState.pendingCommand = null;
  selectedBuildingId.value = null;
  notifySelectionChanged();
}

export function addChatMessageToSignals(msg: ChatMessage): void {
  const msgs = [...chatMessages.value, msg].slice(-100);
  chatMessages.value = msgs;
  const isOwn = msg.senderId === myPlayerId.value;
  const isDirect = msg.targetId !== null;
  if (!isOwn) {
    if (isDirect) {
      const partner = msg.senderId;
      if (chatTab.value !== partner) {
        const m = new Map(chatUnreadDirect.value);
        m.set(partner, (m.get(partner) || 0) + 1);
        chatUnreadDirect.value = m;
      }
    } else {
      if (chatTab.value !== 'global') {
        chatUnreadGlobal.value++;
      }
    }
  }
}

export function syncFromClientState(cs: {
  myPlayerId: string;
  currentTick: number;
  sunAngle: number;
  dayNightCycleTicks: number;
  visibleCells: Map<string, VisibleCellData>;
  revealedCells: Map<string, RevealedCellData>;
  units: Map<string, UnitData>;
  cities: Map<string, CityData>;
  buildings: Map<string, BuildingData>;
  players: Map<string, PlayerSummary>;
  resources: PlayerResourceData;
  hoveredCellId: string | null;
  mouseClientX: number;
  mouseClientY: number;
  selectedTileId: string | null;
  selectedUnitId: string | null;
  selectedCityId: string | null;
  pendingCommand: string | null;
  eliminationEvent: any;
  gameWonEvent: any;
  chatMessages: ChatMessage[];
  chatTab: string;
  chatUnreadGlobal: number;
  chatUnreadDirect: Map<string, number>;
}): void {
  myPlayerId.value = cs.myPlayerId;
  currentTick.value = cs.currentTick;
  lastTickTime.value = Date.now();
  sunAngle.value = cs.sunAngle;
  dayNightCycleTicks.value = cs.dayNightCycleTicks;
  visibleCells.value = new Map(cs.visibleCells);
  revealedCells.value = new Map(cs.revealedCells);
  units.value = new Map(cs.units);
  cities.value = new Map(cs.cities);
  buildings.value = new Map(cs.buildings);
  players.value = new Map(cs.players);
  resources.value = { ...cs.resources };
  hoveredCellId.value = cs.hoveredCellId;
  mouseClientX.value = cs.mouseClientX;
  mouseClientY.value = cs.mouseClientY;
  selectedTileId.value = cs.selectedTileId;
  selectedUnitId.value = cs.selectedUnitId;
  selectedCityId.value = cs.selectedCityId;
  pendingCommand.value = cs.pendingCommand;

  if (!cs.selectedTileId || cs.selectedUnitId || cs.selectedCityId) {
    selectedBuildingId.value = null;
  }

  const mp = cs.players.get(cs.myPlayerId);
  if (mp) myColor.value = mp.color;

  if (cs.eliminationEvent) {
    eliminationEvent.value = cs.eliminationEvent;
    cs.eliminationEvent = null;
  }
  if (cs.gameWonEvent) {
    gameWonEvent.value = cs.gameWonEvent;
    cs.gameWonEvent = null;
  }
}