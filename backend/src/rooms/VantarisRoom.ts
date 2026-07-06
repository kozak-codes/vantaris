import { Room, Client } from '@colyseus/core';
import {
  GameState,
} from '../state/GameState';
import {
  GamePhase, CFG, MATCHMAKING_CFG, AdjacencyMap, buildAdjacencyMap,
  OrbitalBodyType,
  type ConstructionType,
  constructionId,
  sampleWorldTerrain,
} from '@vantaris/shared';
import { generateGlobe } from '../globe';
import { computeVisibilityForPlayer, buildPlayerSlice } from '../mutations/fog';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { ConstructionState } from '../state/ConstructionState';
import { TickSystem } from '../systems/TickSystem';
import { tickCityResourceDrain, tickCityXP, tickInflowResets } from '../mutations/resources';
import { generateStartingSystem, spawnPlayerSpacecraft } from '../worldgen/system';
import { updateOrbitalPositions, advanceOrbitalAnomalies } from '../systems/OrbitalMechanics';
import { generateMacroHexSubHexes } from '../mutations/subhexTerrain';
import { recalcMacroOwnership } from '../mutations/ownership';

interface CreateOptions {
  spawnPoints: { cellId: string }[];
  dayNightCycleTicks?: number;
  worldSeed?: number;
}

function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export class VantarisRoom extends Room<GameState> {
  maxClients = 8;
  private adjacencyMap: AdjacencyMap = {};
  private cellPositions: Record<string, [number, number, number]> = {};
  private tickSystem = new TickSystem();
  private worldSeed: number = 42;

  async onCreate(options: CreateOptions): Promise<void> {
    const playerCount = options.spawnPoints?.length || 1;
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    this.maxClients = MATCHMAKING_CFG.MAX_PLAYERS;
    const worldSeed = options.worldSeed ?? hashStringToSeed(this.roomId);
    this.worldSeed = worldSeed;
    const globe = generateGlobe(subdivideLevel, worldSeed);

    this.setState(new GameState());

    this.state.dayNightCycleTicks = options.dayNightCycleTicks || CFG.DAY_NIGHT.CYCLE_TICKS;
    this.state.worldSeed = worldSeed;

    const cellIds: string[] = [];
    for (const cell of globe.cells) {
      const cellState = new CellState();
      cellState.cellId = cell.id;
      cellState.ownerId = '';
      cellState.isPentagon = cell.isPentagon;
      this.state.cells.set(cell.id, cellState);
      cellIds.push(cell.id);
      this.cellPositions[cell.id] = cell.center;
    }

    const rawAdjacency = globe.adjacency;
    const adjacencyWithStringKeys: AdjacencyMap = {};
    for (const [cellId, neighbors] of rawAdjacency) {
      adjacencyWithStringKeys[cellId] = [...neighbors];
    }

    this.adjacencyMap = adjacencyWithStringKeys;

    const distanceAdjacency = buildAdjacencyMap(cellIds, this.cellPositions);
    for (const cellId of cellIds) {
      if (!this.adjacencyMap[cellId] || this.adjacencyMap[cellId].length === 0) {
        this.adjacencyMap[cellId] = distanceAdjacency[cellId] || [];
      }
    }

    this.state.phase = GamePhase.ACTIVE;

    generateStartingSystem(this.state);
    updateOrbitalPositions(this.state);

    this.tickSystem.start((tick) => this.onTick(tick));

    this.onMessage('renameCity', (client, data: { cityId: string; name: string }) => {
      this.handleRenameCity(client, data);
    });

    this.onMessage('ping', (client) => {
      client.send('pong', { serverTick: this.state.tick });
    });

    this.onMessage('chatMessage', (client, data: { text: string }) => {
      this.handleChatMessage(client, data.text);
    });

    this.onMessage('chatDirect', (client, data: { targetId: string; text: string }) => {
      this.handleDirectMessage(client, data.targetId, data.text);
    });

    this.onMessage('updateCamera', (client, data: { qx: number; qy: number; qz: number; qw: number; zoom: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.cameraQuatX = data.qx;
        player.cameraQuatY = data.qy;
        player.cameraQuatZ = data.qz;
        player.cameraQuatW = data.qw;
        player.cameraZoom = data.zoom;
      }
    });

    this.onMessage('setOrbit', (client, data: { bodyId: string; semiMajorAxis?: number; inclination?: number; eccentricity?: number }) => {
      this.handleSetOrbit(client, data);
    });

    this.onMessage('land', (client, data: { bodyId: string; cellId: string }) => {
      this.handleLand(client, data);
    });

    this.onMessage('build', (client, data: { macroCellId: string; subHexIndex: number; type: ConstructionType }) => {
      this.handleBuild(client, data);
    });

    this.onMessage('scrap', (client, data: { constructionId: string }) => {
      this.handleScrap(client, data);
    });
  }

  onJoin(client: Client, options: { spawnPoint?: string; displayName?: string }): void {
    const playerId = client.sessionId;
    const player = new PlayerState();
    player.playerId = playerId;
    player.displayName = options?.displayName || `Player ${this.state.players.size + 1}`;
    player.color = CFG.PLAYER_COLORS[this.state.players.size % CFG.PLAYER_COLORS.length];
    player.territoryCellCount = 0;
    player.energyCredits = 0;

    this.state.players.set(playerId, player);

    spawnPlayerSpacecraft(this.state, playerId, player.displayName);
    updateOrbitalPositions(this.state);

    computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, undefined, this.cellPositions);

    const slice = buildPlayerSlice(this.state, playerId);
    client.send('stateUpdate', slice);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (consented) return;
    try {
      await this.allowReconnection(client, MATCHMAKING_CFG.RECONNECTION_WINDOW_MS);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        computeVisibilityForPlayer(this.state, client.sessionId, this.adjacencyMap, undefined, this.cellPositions);
        const slice = buildPlayerSlice(this.state, client.sessionId);
        client.send('stateUpdate', slice);
      }
    } catch {
      // reconnection timeout
    }
  }

  onDispose(): void {
    this.tickSystem.stop();
  }

  private onTick(tick: number): void {
    tickCityResourceDrain(this.state);
    tickCityXP(this.state);
    tickInflowResets(this.state);
    advanceOrbitalAnomalies(this.state, CFG.TICK_RATE_MS / 1000);
    updateOrbitalPositions(this.state);
    this.broadcastPlayerSlices();
    this.state.tick = tick;
  }

  private broadcastPlayerSlices(): void {
    for (const client of this.clients) {
      const playerId = client.sessionId;
    computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, undefined, this.cellPositions);
      const slice = buildPlayerSlice(this.state, playerId);
      client.send('stateUpdate', slice);
    }
  }

  private handleRenameCity(client: Client, data: { cityId: string; name: string }): void {
    const playerId = client.sessionId;
    let city: any = null;
    for (const [, c] of this.state.cities) {
      if (c.cityId === data.cityId && c.ownerId === playerId) { city = c; break; }
    }
    if (!city) return;

    const trimmed = data.name.trim().slice(0, 24);
    if (trimmed.length === 0) return;

    city.name = trimmed;
  }

  private handleSetOrbit(client: Client, data: { bodyId: string; semiMajorAxis?: number; inclination?: number; eccentricity?: number }): void {
    const body = this.state.orbitalBodies.get(data.bodyId);
    if (!body || body.type !== OrbitalBodyType.SPACECRAFT) return;
    if (body.ownerId !== client.sessionId) return;
    if (body.landedCellId) return; // can't change orbit while landed

    const el = body.elements;
    if (data.semiMajorAxis !== undefined && data.semiMajorAxis > 0) el.semiMajorAxis = data.semiMajorAxis;
    if (data.inclination !== undefined) el.inclination = data.inclination;
    if (data.eccentricity !== undefined && data.eccentricity >= 0 && data.eccentricity < 1) el.eccentricity = data.eccentricity;
  }

  private handleLand(client: Client, data: { bodyId: string; cellId: string }): void {
    const body = this.state.orbitalBodies.get(data.bodyId);
    if (!body || body.type !== OrbitalBodyType.SPACECRAFT) return;
    if (body.ownerId !== client.sessionId) return;
    if (body.landedCellId) return;

    const cell = this.state.cells.get(data.cellId);
    if (!cell) return;

    // Check that the cell center isn't ocean by sampling the world terrain.
    const center = this.cellPositions[data.cellId];
    if (center) {
      const { subBiome } = sampleWorldTerrain(center, this.state.worldSeed);
      if (subBiome === 'WATER' || subBiome === 'ICE') return;
    }

    body.landedCellId = data.cellId;
  }

  private handleBuild(
    client: Client,
    data: { macroCellId: string; subHexIndex: number; type: ConstructionType },
  ): void {
    const playerId = client.sessionId;
    const cell = this.state.cells.get(data.macroCellId);
    if (!cell) return;

    // Must be visible to the player (revealed by spacecraft).
    const player = this.state.players.get(playerId);
    if (!player) return;
    if (player.fog.visibility.get(data.macroCellId) !== 'VISIBLE') return;

    // Must not already have a construction at this sub-hex.
    const id = constructionId(data.macroCellId, data.subHexIndex);
    if (this.state.constructions.get(id)) return;

    // Validate terrain buildability.
    const subHexes = generateMacroHexSubHexes(cell, this.cellPositions, this.worldSeed);
    if (!subHexes) return;
    if (data.subHexIndex < 0 || data.subHexIndex >= subHexes.length) return;
    if (!subHexes[data.subHexIndex].buildable) return;

    // Must have a landed spacecraft on this macro hex (or adjacent? for now, same hex).
    let hasLander = false;
    for (const [, body] of this.state.orbitalBodies) {
      if (body.ownerId === playerId && body.type === OrbitalBodyType.SPACECRAFT && body.landedCellId === data.macroCellId) {
        hasLander = true;
        break;
      }
    }
    if (!hasLander) return;

    const construction = new ConstructionState();
    construction.id = id;
    construction.macroCellId = data.macroCellId;
    construction.subHexIndex = data.subHexIndex;
    construction.type = data.type;
    construction.ownerId = playerId;
    this.state.constructions.set(id, construction);

    recalcMacroOwnership(this.state, data.macroCellId);
  }

  private handleScrap(client: Client, data: { constructionId: string }): void {
    const playerId = client.sessionId;
    const construction = this.state.constructions.get(data.constructionId);
    if (!construction) return;
    if (construction.ownerId !== playerId) return;

    const macroCellId = construction.macroCellId;
    this.state.constructions.delete(data.constructionId);
    recalcMacroOwnership(this.state, macroCellId);
  }

  private handleChatMessage(client: Client, text: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const trimmed = (text || '').slice(0, 200).trim();
    if (!trimmed) return;

    const msg = {
      id: `chat_${this.state.tick}_${client.sessionId}`,
      senderId: client.sessionId,
      senderName: player.displayName,
      senderColor: player.color,
      text: trimmed,
      timestamp: Date.now(),
      targetId: null as string | null,
    };

    for (const c of this.clients) {
      c.send('chatMessage', msg);
    }
  }

  private handleDirectMessage(client: Client, targetId: string, text: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const trimmed = (text || '').slice(0, 200).trim();
    if (!trimmed) return;

    const msg = {
      id: `dm_${this.state.tick}_${client.sessionId}`,
      senderId: client.sessionId,
      senderName: player.displayName,
      senderColor: player.color,
      text: trimmed,
      timestamp: Date.now(),
      targetId,
    };

    client.send('chatMessage', msg);

    for (const c of this.clients) {
      if (c.sessionId === targetId) {
        c.send('chatMessage', msg);
        break;
      }
    }
  }
}