import { signal, computed } from '@preact/signals';
import type { VisibleCellData, RevealedCellData, CityData, PlayerSummary, PlayerResourceData, ChatMessage, OrbitalBodyData, ConstructionData } from '@vantaris/shared';
import { clientState, notifySelectionChanged } from './ClientState';

export const myPlayerId = signal<string>('');
export const myColor = signal<string>('#4488ff');
export const phase = signal<string>('');
export const currentTick = signal<number>(0);
export const sunAngle = signal<number>(0);
export const dayNightCycleTicks = signal<number>(600);

export const selectedTileId = signal<string | null>(null);
export const selectedCityId = signal<string | null>(null);
export const hoveredCellId = signal<string | null>(null);
export const mouseClientX = signal<number>(0);
export const mouseClientY = signal<number>(0);

export type ViewMode = 'system' | 'planet';
export const viewMode = signal<ViewMode>('system');

export const visibleCells = signal<Map<string, VisibleCellData>>(new Map());
export const revealedCells = signal<Map<string, RevealedCellData>>(new Map());
export const cities = signal<Map<string, CityData>>(new Map());
export const players = signal<Map<string, PlayerSummary>>(new Map());
export const orbitalBodies = signal<Map<string, OrbitalBodyData>>(new Map());
export const constructions = signal<Map<string, ConstructionData>>(new Map());
export const worldSeed = signal<number>(0);
export const resources = signal<PlayerResourceData>({ food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0, energyCredits: 0, claimCompensation: 0, foodCreditRate: 1 });

export const chatMessages = signal<ChatMessage[]>([]);
export const chatTab = signal<string>('global');
export const chatUnreadGlobal = signal<number>(0);
export const chatUnreadDirect = signal<Map<string, number>>(new Map());

export const connected = signal<boolean>(false);
export const lastTickTime = signal<number>(0);
// The planet/moon we're currently viewing in planet view. Set when entering
// planet view; used by the PlanetView bar to show the body name.
export const viewedBodyId = signal<string | null>(null);

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

export const selectedCity = computed(() => {
  const cityId = selectedCityId.value;
  if (!cityId) return null;
  return cities.value.get(cityId) ?? null;
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

export function selectTile(tileId: string | null) {
  clientState.selectedTileId = tileId;
  clientState.selectedCityId = null;
  notifySelectionChanged();
}

export function enterPlanetView(bodyId?: string) {
  clientState.viewMode = 'planet';
  clientState.selectedCityId = null;
  viewedBodyId.value = bodyId ?? null;
  notifySelectionChanged();
}

export function exitPlanetView() {
  clientState.viewMode = 'system';
  notifySelectionChanged();
}

export function enterSystemView() {
  clientState.viewMode = 'system';
  notifySelectionChanged();
}

export function selectCity(cityId: string | null) {
  clientState.selectedCityId = cityId;
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
  cities: Map<string, CityData>;
  players: Map<string, PlayerSummary>;
  resources: PlayerResourceData;
  orbitalBodies: Map<string, OrbitalBodyData>;
  constructions: Map<string, ConstructionData>;
  worldSeed: number;
  hoveredCellId: string | null;
  mouseClientX: number;
  mouseClientY: number;
  selectedTileId: string | null;
  selectedCityId: string | null;
  viewMode: 'system' | 'planet';
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
  cities.value = new Map(cs.cities);
  players.value = new Map(cs.players);
  orbitalBodies.value = new Map(cs.orbitalBodies);
  constructions.value = new Map(cs.constructions);
  worldSeed.value = cs.worldSeed;
  resources.value = { ...cs.resources };
  hoveredCellId.value = cs.hoveredCellId;
  mouseClientX.value = cs.mouseClientX;
  mouseClientY.value = cs.mouseClientY;
  selectedTileId.value = cs.selectedTileId;
  selectedCityId.value = cs.selectedCityId;
  viewMode.value = cs.viewMode;

  const mp = cs.players.get(cs.myPlayerId);
  if (mp) myColor.value = mp.color;
}