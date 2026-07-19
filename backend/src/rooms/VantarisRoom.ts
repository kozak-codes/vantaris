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
import { generateMacroHexSubHexes, computeSubHexPositions } from '../mutations/subhexTerrain';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { ConstructionState } from '../state/ConstructionState';
import { TickSystem } from '../systems/TickSystem';
import { tickCityResourceDrain, tickCityXP, tickInflowResets } from '../mutations/resources';
import { generateStartingSystem, spawnPlayerSpacecraft } from '../worldgen/system';
import { updateOrbitalPositions, advanceOrbitalAnomalies } from '../systems/OrbitalMechanics';
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
    const subdivideLevel = CFG.GLOBE.subdivideLevel;
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

    this.onMessage('landNow', (client, data: { bodyId: string }) => {
      this.handleLandNow(client, data);
    });

    this.onMessage('landAt', (client, data: { bodyId: string; cellId: string }) => {
      this.handleLandAt(client, data);
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
    this.tickDescents();
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
    body.landedSubHex = -1; // manual land — no specific sub-hex
  }

  private handleLandNow(client: Client, data: { bodyId: string }): void {
    const body = this.state.orbitalBodies.get(data.bodyId);
    if (!body || body.type !== OrbitalBodyType.SPACECRAFT) return;
    if (body.ownerId !== client.sessionId) return;
    if (body.landedCellId || body.descending) return;

    // Find the cell directly below the spacecraft.
    const closestCellId = this.findCellBelow(body);
    if (!closestCellId) return;

    // Try the closest cell, then BFS outward for a buildable sub-hex.
    const result = this.findBuildableSubHex(closestCellId, 5);
    if (result) {
      body.landedCellId = result.cellId;
      body.landedSubHex = result.subHex;
    }
  }

  /**
   * Begin a descent animation from the lander's current orbit to the chosen
   * surface cell. Validates the target is within `CFG.LANDING.wiggleCells`
   * adjacency hops of the lander's current sub-point cell.
   */
  private handleLandAt(client: Client, data: { bodyId: string; cellId: string }): void {
    const body = this.state.orbitalBodies.get(data.bodyId);
    if (!body || body.type !== OrbitalBodyType.SPACECRAFT) return;
    if (body.ownerId !== client.sessionId) return;
    if (body.landedCellId || body.descending) return;

    const targetCell = this.state.cells.get(data.cellId);
    if (!targetCell) return;

    // Refuse ocean targets — sample the cell center terrain.
    const center = this.cellPositions[data.cellId];
    if (center) {
      const { subBiome } = sampleWorldTerrain(center, this.state.worldSeed);
      if (subBiome === 'WATER' || subBiome === 'ICE') return;
    }

    // Validate the target is on our ground track (within wiggle cells of the
    // current sub-point).
    const subCellId = this.findCellBelow(body);
    if (!subCellId) return;
    if (!this.isWithinWiggle(subCellId, data.cellId, CFG.LANDING.wiggleCells)) return;

    // Begin descent. Snapshot the start position (star-relative km) so we can
    // lerp over the next `descentTicks` ticks. Bump the orbit semi-major axis
    // up so the orbit line visually rises (and the lander reads as "higher").
    const ticks = CFG.LANDING.descentTicks;
    body.descending = true;
    body.descentTargetCellId = data.cellId;
    body.descentTicksRemaining = ticks;
    body.descentTotalTicks = ticks;
    body.descentStartPosX = body.posX;
    body.descentStartPosY = body.posY;
    body.descentStartPosZ = body.posZ;
    body.savedSemiMajorAxis = body.elements.semiMajorAxis;
    body.elements.semiMajorAxis = CFG.LANDING.descentOrbitKm;
  }

  /**
   * Advance all descending landers toward their targets. Called every tick.
   * When the countdown hits zero, finalize the landing: pick a buildable
   * sub-hex in the target cell (BFS outward if none) and restore the orbit.
   */
  private tickDescents(): void {
    for (const [, body] of this.state.orbitalBodies) {
      if (!body.descending) continue;
      if (body.descentTicksRemaining <= 0) {
        // Finalize: land at the target cell.
        const targetCellId = body.descentTargetCellId;
        const result = targetCellId ? this.findBuildableSubHex(targetCellId, 5) : null;
        if (result) {
          body.landedCellId = result.cellId;
          body.landedSubHex = result.subHex;
        } else if (targetCellId) {
          // No buildable sub-hex anywhere nearby — land anyway at cell center.
          body.landedCellId = targetCellId;
          body.landedSubHex = -1;
        }
        body.descending = false;
        body.descentTargetCellId = '';
        body.descentTicksRemaining = 0;
        body.descentTotalTicks = 0;
        if (body.savedSemiMajorAxis > 0) {
          body.elements.semiMajorAxis = body.savedSemiMajorAxis;
          body.savedSemiMajorAxis = 0;
        }
        continue;
      }

      // Lerp position from descent start to the target cell's surface point
      // (in star-relative km). The target surface point is parent center +
      // (cell unit vector × planet radius in km). We use the cell-center
      // direction × planet radius for the end point; the precise sub-hex
      // offset is below rendering precision at system scale.
      const parent = this.state.orbitalBodies.get(body.elements.parent);
      if (!parent) {
        body.descentTicksRemaining--;
        continue;
      }
      const targetPos = this.cellPositions[body.descentTargetCellId!];
      if (!targetPos) {
        body.descentTicksRemaining--;
        continue;
      }
      const cellLen = Math.sqrt(targetPos[0] ** 2 + targetPos[1] ** 2 + targetPos[2] ** 2) || 1;
      const planetRadiusKm = CFG.SYSTEM.PLANET_RADIUS_KM;
      const endX = parent.posX + (targetPos[0] / cellLen) * planetRadiusKm;
      const endY = parent.posY + (targetPos[1] / cellLen) * planetRadiusKm;
      const endZ = parent.posZ + (targetPos[2] / cellLen) * planetRadiusKm;

      // Ease-out t — start fast, slow down as we approach the surface.
      const remaining = body.descentTicksRemaining;
      const total = body.descentTotalTicks || 1;
      const linearT = 1 - (remaining / total); // 0 → 1 over the descent
      const t = 1 - Math.pow(1 - linearT, 2); // ease-out quad

      body.posX = body.descentStartPosX + (endX - body.descentStartPosX) * t;
      body.posY = body.descentStartPosY + (endY - body.descentStartPosY) * t;
      body.posZ = body.descentStartPosZ + (endZ - body.descentStartPosZ) * t;

      body.descentTicksRemaining--;
    }
  }

  /** Find the macro cell directly below a spacecraft (highest dot product). */
  private findCellBelow(body: any): string | null {
    const parent = this.state.orbitalBodies.get(body.elements.parent);
    if (!parent) return null;
    const dx = body.posX - parent.posX;
    const dy = body.posY - parent.posY;
    const dz = body.posZ - parent.posZ;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len === 0) return null;
    const ux = dx / len, uy = dy / len, uz = dz / len;

    let bestId: string | null = null;
    let bestDot = -Infinity;
    for (const [cellId, pos] of Object.entries(this.cellPositions)) {
      const clen = Math.sqrt(pos[0] ** 2 + pos[1] ** 2 + pos[2] ** 2);
      if (clen === 0) continue;
      const dot = (pos[0] * ux + pos[1] * uy + pos[2] * uz) / clen;
      if (dot > bestDot) {
        bestDot = dot;
        bestId = cellId;
      }
    }
    return bestId;
  }

  /**
   * BFS from `startCellId` up to `maxHops` away. Returns true if `targetCellId`
   * is within that range (inclusive of `startCellId` itself).
   */
  private isWithinWiggle(startCellId: string, targetCellId: string, maxHops: number): boolean {
    if (startCellId === targetCellId) return true;
    const visited = new Set<string>([startCellId]);
    let frontier = new Set<string>([startCellId]);
    for (let i = 0; i < maxHops; i++) {
      const next: Set<string> = new Set();
      for (const cellId of frontier) {
        const neighbors = this.adjacencyMap[cellId] ?? [];
        for (const nId of neighbors) {
          if (nId === targetCellId) return true;
          if (visited.has(nId)) continue;
          visited.add(nId);
          next.add(nId);
        }
      }
      frontier = next;
    }
    return false;
  }

  /**
   * Find a buildable sub-hex in `cellId`, or BFS outward up to `maxHops` cells
   * if none. Returns the cellId + sub-hex index of the chosen buildable spot,
   * or null if nothing was found within range.
   */
  private findBuildableSubHex(cellId: string, maxHops: number): { cellId: string; subHex: number } | null {
    const tryCell = (cid: string): { cellId: string; subHex: number } | null => {
      const cell = this.state.cells.get(cid);
      if (!cell) return null;
      const subHexes = generateMacroHexSubHexes(cell, this.cellPositions, this.state.worldSeed);
      if (!subHexes) return null;
      const center = this.cellPositions[cid];
      if (!center) return null;
      const cellLen = Math.sqrt(center[0] ** 2 + center[1] ** 2 + center[2] ** 2) || 1;
      const cx = center[0] / cellLen, cy = center[1] / cellLen, cz = center[2] / cellLen;
      const positions = computeSubHexPositions(center);

      let bestIdx = -1;
      let bestDot = -Infinity;
      for (let i = 0; i < subHexes.length; i++) {
        if (!subHexes[i].buildable) continue;
        const p = positions[i];
        const pLen = Math.sqrt(p[0] ** 2 + p[1] ** 2 + p[2] ** 2) || 1;
        const dot = (p[0] * cx + p[1] * cy + p[2] * cz) / pLen;
        if (dot > bestDot) {
          bestDot = dot;
          bestIdx = i;
        }
      }
      return bestIdx >= 0 ? { cellId: cid, subHex: bestIdx } : null;
    };

    const direct = tryCell(cellId);
    if (direct) return direct;

    const visited = new Set<string>([cellId]);
    const queue: { cellId: string; dist: number }[] = [{ cellId, dist: 0 }];
    while (queue.length > 0) {
      const { cellId: cid, dist } = queue.shift()!;
      if (dist > 0) {
        const r = tryCell(cid);
        if (r) return r;
      }
      if (dist >= maxHops) continue;
      const neighbors = this.adjacencyMap[cid];
      if (!neighbors) continue;
      for (const nId of neighbors) {
        if (visited.has(nId)) continue;
        visited.add(nId);
        queue.push({ cellId: nId, dist: dist + 1 });
      }
    }
    return null;
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