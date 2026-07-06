import { Room, Client } from '@colyseus/core';
import { GameState } from '../state/GameState';
import { GamePhase, CFG, MATCHMAKING_CFG, AdjacencyMap, buildAdjacencyMap, OrbitalBodyType, TerrainType } from '@vantaris/shared';
import { generateGlobe } from '../globe';
import { computeVisibilityForPlayer, buildPlayerSlice } from '../mutations/fog';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { TickSystem } from '../systems/TickSystem';
import { tickCityResourceDrain, tickCityXP, tickInflowResets } from '../mutations/resources';
import { generateStartingSystem, spawnPlayerSpacecraft } from '../worldgen/system';
import { updateOrbitalPositions, advanceOrbitalAnomalies } from '../systems/OrbitalMechanics';

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

  async onCreate(options: CreateOptions): Promise<void> {
    const playerCount = options.spawnPoints?.length || 1;
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    this.maxClients = MATCHMAKING_CFG.MAX_PLAYERS;
    const worldSeed = options.worldSeed ?? hashStringToSeed(this.roomId);
    const globe = generateGlobe(subdivideLevel, worldSeed);

    this.setState(new GameState());

    this.state.dayNightCycleTicks = options.dayNightCycleTicks || CFG.DAY_NIGHT.CYCLE_TICKS;

    const cellIds: string[] = [];
    for (const cell of globe.cells) {
      const cellState = new CellState();
      cellState.cellId = cell.id;
      cellState.biome = cell.biome;
      cellState.ownerId = '';
      cellState.hasCity = false;
      cellState.cityId = '';
      cellState.elevation = cell.elevation;
      cellState.moisture = cell.moisture;
      cellState.temperature = cell.temperature;
      cellState.plateId = cell.plateId;
      cellState.resourceType = cell.resourceType as any;
      cellState.resourceAmount = cell.resourceAmount;
      cellState.ruin = cell.ruin;
      cellState.ruinRevealed = cell.ruinRevealed;
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

    this.tickSystem.start((tick) => this.onTick(tick));

    this.onMessage('renameCity', (client, data: { cityId: string; name: string }) => {
      this.handleRenameCity(client, data);
    });

    this.onMessage('revealRuin', (client, data: { cellId: string }) => {
      const cell = this.state.cells.get(data.cellId);
      if (cell && cell.ruin && !cell.ruinRevealed) {
        cell.ruinRevealed = true;
      }
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
    if (!cell || cell.biome === TerrainType.OCEAN) return;

    body.landedCellId = data.cellId;
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