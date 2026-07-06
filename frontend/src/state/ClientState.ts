import {
  type PlayerStateSlice,
  type VisibleCellData,
  type RevealedCellData,
  type CityData,
  type PlayerSummary,
  type RuinMarkerData,
  type ChatMessage,
  type PlayerResourceData,
  type OrbitalBodyData,
} from '@vantaris/shared';
import { syncFromClientState, addChatMessageToSignals } from './signals';

export interface ClientState {
  myPlayerId: string;
  currentTick: number;
  sunAngle: number;
  dayNightCycleTicks: number;
  visibleCells: Map<string, VisibleCellData>;
  revealedCells: Map<string, RevealedCellData>;
  ruinMarkers: Map<string, RuinMarkerData>;
  cities: Map<string, CityData>;
  players: Map<string, PlayerSummary>;
  resources: PlayerResourceData;
  orbitalBodies: Map<string, OrbitalBodyData>;
  selectedTileId: string | null;
  selectedCityId: string | null;
  hoveredCellId: string | null;
  mouseClientX: number;
  mouseClientY: number;
  viewMode: 'system' | 'planet' | 'tile' | 'world';
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
  cities: new Map(),
  players: new Map(),
  resources: { food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0, energyCredits: 0, claimCompensation: 0, foodCreditRate: 1 },
  orbitalBodies: new Map(),
  selectedTileId: null,
  selectedCityId: null,
  hoveredCellId: null,
  mouseClientX: 0,
  mouseClientY: 0,
  viewMode: 'planet',
  chatMessages: [],
  chatTab: 'global' as string,
  chatUnreadGlobal: 0,
  chatUnreadDirect: new Map<string, number>(),
};

type RenderCallback = () => void;
const renderCallbacks: RenderCallback[] = [];
let hasReceivedFirstState = false;

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
  addChatMessageToSignals(msg);
  notifyRenderers();
}

export function notifySelectionChanged(): void {
  validateSelections();
  syncFromClientState(clientState);
  notifyRenderers();
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

  clientState.cities.clear();
  for (const city of slice.cities) {
    clientState.cities.set(city.cityId, city);
  }

  clientState.players.clear();
  for (const player of slice.players) {
    clientState.players.set(player.playerId, player);
  }

  clientState.orbitalBodies.clear();
  if (slice.orbitalBodies) {
    for (const body of slice.orbitalBodies) {
      clientState.orbitalBodies.set(body.bodyId, body);
    }
  }

  if (slice.resources) {
    clientState.resources = { ...slice.resources };
  }

  validateSelections();
  notifyRenderers();

  if (!hasReceivedFirstState && clientState.orbitalBodies.size > 0) {
    hasReceivedFirstState = true;
    // Find the player's spacecraft and focus on it in planet view.
    let mySpacecraftId: string | null = null;
    let mySpacecraftParent: string | null = null;
    for (const [, body] of clientState.orbitalBodies) {
      if (body.type === 'SPACECRAFT' && body.ownerId === clientState.myPlayerId) {
        mySpacecraftId = body.bodyId;
        mySpacecraftParent = body.elements.parent;
        break;
      }
    }
    if (mySpacecraftId) {
      // Lazy import to avoid circular dependency.
      import('./signals').then(({ focusedBodyId, viewedBodyId }) => {
        focusedBodyId.value = mySpacecraftId;
        viewedBodyId.value = mySpacecraftParent;
      });
      clientState.viewMode = 'planet';
    }
  }

  syncFromClientState(clientState);
}

function validateSelections(): void {
  if (clientState.selectedTileId) {
    const tileVisible = clientState.visibleCells.has(clientState.selectedTileId);
    const tileRevealed = clientState.revealedCells.has(clientState.selectedTileId);
    if (!tileVisible && !tileRevealed) {
      clientState.selectedTileId = null;
      clientState.selectedCityId = null;
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
}

export function clearClientState(): void {
  clientState.myPlayerId = '';
  clientState.currentTick = 0;
  clientState.sunAngle = 0;
  clientState.dayNightCycleTicks = 600;
  clientState.visibleCells.clear();
  clientState.revealedCells.clear();
  clientState.ruinMarkers.clear();
  clientState.cities.clear();
  clientState.players.clear();
  clientState.orbitalBodies.clear();
  clientState.resources = { food: 0, energy: 0, foodPerTick: 0, energyPerTick: 0, totalPopulation: 0, factoryCount: 0, energyCredits: 0, claimCompensation: 0, foodCreditRate: 1 };
  clientState.selectedTileId = null;
  clientState.selectedCityId = null;
  clientState.hoveredCellId = null;
  clientState.mouseClientX = 0;
  clientState.mouseClientY = 0;
  clientState.viewMode = 'system';
  clientState.chatMessages = [];
  clientState.chatTab = 'global';
  clientState.chatUnreadGlobal = 0;
  clientState.chatUnreadDirect.clear();
  hasReceivedFirstState = false;
}