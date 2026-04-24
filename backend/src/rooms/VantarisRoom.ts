import { Room, Client } from '@colyseus/core';
import { GameState } from '../state/GameState';
import { GamePhase, BiomeType } from '@vantaris/shared';
import { QUEUE_CONFIG, RECONNECTION_WINDOW, TROOP_VISION_RANGE, MAX_UNITS_PER_HEX } from '@vantaris/shared/constants';
import { AdjacencyMap, buildAdjacencyMap } from '@vantaris/shared';
import { generateGlobe } from '../globe';
import { computeVisibilityForPlayer, buildPlayerSlice } from '../mutations/fog';
import { completeClaim } from '../mutations/units';
import { createCity, tickCityProduction } from '../mutations/cities';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';
import { UnitState } from '../state/UnitState';
import { TickSystem } from '../systems/TickSystem';
import { findPath, buildUnitsByCellId } from '../systems/Pathfinding';
import { spawnUnit, assignPath, stepUnit, startClaiming } from '../mutations/units';
import type { StepResult } from '../mutations/units';

interface CreateOptions {
  spawnPoints: { cellId: string }[];
}

const PLAYER_COLORS = [
  '#4488ff',
  '#ff4444',
  '#44cc44',
  '#ffaa00',
  '#cc44cc',
  '#44cccc',
  '#ff8844',
  '#8844ff',
];

export class VantarisRoom extends Room<GameState> {
  maxClients = 8;
  private adjacencyMap: AdjacencyMap = {};
  private cellPositions: Record<string, [number, number, number]> = {};
  private tickSystem = new TickSystem();

  async onCreate(options: CreateOptions): Promise<void> {
    const playerCount = options.spawnPoints?.length || 1;
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    this.maxClients = QUEUE_CONFIG.maxPlayers;
    const globe = generateGlobe(subdivideLevel);

    this.setState(new GameState());

    const cellIds: string[] = [];
    for (const cell of globe.cells) {
      const cellState = new CellState();
      cellState.cellId = cell.id;
      cellState.biome = cell.biome;
      cellState.ownerId = '';
      cellState.hasCity = false;
      cellState.cityId = '';
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

    this.tickSystem.start((tick) => this.onTick(tick));

    this.onMessage('moveUnit', (client, data: { unitId: string; targetCellId: string }) => {
      this.handleMoveUnit(client, data);
    });

    this.onMessage('setUnitIdle', (client, data: { unitId: string }) => {
      this.handleSetUnitIdle(client, data);
    });

    this.onMessage('toggleCityProduction', (client, data: { cityId: string; producing: boolean }) => {
      this.handleToggleCityProduction(client, data);
    });

    this.onMessage('claimTerritory', (client, data: { unitId: string }) => {
      this.handleClaimTerritory(client, data);
    });

    this.onMessage('ping', (client) => {
      client.send('pong', { serverTick: this.state.tick });
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
  }

  onJoin(client: Client, options: { spawnPoint?: string; displayName?: string }): void {
    const playerId = client.sessionId;
    const player = new PlayerState();
    player.playerId = playerId;
    player.displayName = options?.displayName || `Player ${this.state.players.size + 1}`;
    player.color = PLAYER_COLORS[this.state.players.size % PLAYER_COLORS.length];
    player.territoryCellCount = 0;

    const spawnCellId = this.findAvailableSpawnCell();
    if (!spawnCellId) {
      console.error('[vantaris] No available spawn cell for player', playerId);
      return;
    }

    this.state.players.set(playerId, player);

    const city = createCity(this.state, playerId, spawnCellId);
    city.producingUnit = true;

    completeClaim(this.state, spawnCellId, playerId);

    computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, TROOP_VISION_RANGE);

    const slice = buildPlayerSlice(this.state, playerId);
    client.send('stateUpdate', slice);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (consented) return;
    try {
      await this.allowReconnection(client, RECONNECTION_WINDOW);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        computeVisibilityForPlayer(this.state, client.sessionId, this.adjacencyMap, TROOP_VISION_RANGE);
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
    this.processCityProduction(tick);
    this.processUnitMovement();
    this.processClaimTimers();
    this.broadcastPlayerSlices();
    this.state.tick = tick;
  }

  private processCityProduction(tick: number): void {
    for (const [, city] of this.state.cities) {
      const shouldSpawn = tickCityProduction(city);
      if (shouldSpawn) {
        const unitsOnCell = this.countUnitsOnCell(city.cellId);
        if (unitsOnCell < MAX_UNITS_PER_HEX) {
          spawnUnit(this.state, city.ownerId, city.cellId);
        }
      }
    }
  }

  private processUnitMovement(): void {
    for (const [, unit] of this.state.units) {
      if (unit.status === 'MOVING') {
        const result = stepUnit(this.state, unit.unitId, this.adjacencyMap);
        if (result && result.arrived) {
          const cell = this.state.cells.get(result.cellId);
          if (cell && !cell.ownerId) {
            startClaiming(this.state, unit.unitId);
          }
        }
      }
    }
  }

  private processClaimTimers(): void {
    const completedClaims: { unitId: string; cellId: string; ownerId: string }[] = [];

    for (const [, unit] of this.state.units) {
      if (unit.status === 'CLAIMING') {
        unit.claimTicksRemaining--;
        if (unit.claimTicksRemaining <= 0) {
          completedClaims.push({
            unitId: unit.unitId,
            cellId: unit.cellId,
            ownerId: unit.ownerId,
          });
        }
      }
    }

    for (const claim of completedClaims) {
      const unit = this.state.units.get(claim.unitId);
      if (unit) {
        unit.status = 'IDLE';
        unit.claimTicksRemaining = 0;
      }
      completeClaim(this.state, claim.cellId, claim.ownerId);

      const owner = this.state.players.get(claim.ownerId);
      if (owner) {
        computeVisibilityForPlayer(this.state, claim.ownerId, this.adjacencyMap, TROOP_VISION_RANGE);
      }
    }
  }

  private broadcastPlayerSlices(): void {
    for (const client of this.clients) {
      const playerId = client.sessionId;
      computeVisibilityForPlayer(this.state, playerId, this.adjacencyMap, TROOP_VISION_RANGE);
      const slice = buildPlayerSlice(this.state, playerId);
      client.send('stateUpdate', slice);
    }
  }

  private handleMoveUnit(client: Client, data: { unitId: string; targetCellId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    const targetCell = this.state.cells.get(data.targetCellId);
    if (!targetCell || targetCell.biome === BiomeType.Ocean) {
      client.send('error', { type: 'error', code: 'NO_PATH' });
      return;
    }

    const unitsByCellId = buildUnitsByCellId(this.state.units);

    const path = findPath(
      unit.cellId,
      data.targetCellId,
      this.state.cells,
      this.adjacencyMap,
      unitsByCellId,
      MAX_UNITS_PER_HEX,
      this.cellPositions,
    );

    if (!path) {
      client.send('error', { type: 'error', code: 'NO_PATH' });
      return;
    }

    assignPath(this.state, unit.unitId, path);
  }

  private handleSetUnitIdle(client: Client, data: { unitId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId) return;

    unit.status = 'IDLE';
    unit.path = '[]';
    unit.movementTicksRemaining = 0;
    unit.claimTicksRemaining = 0;
  }

  private handleToggleCityProduction(client: Client, data: { cityId: string; producing: boolean }): void {
    const playerId = client.sessionId;
    const city = this.state.cities.get(data.cityId);
    if (!city || city.ownerId !== playerId) return;

    city.producingUnit = data.producing;
  }

  private handleClaimTerritory(client: Client, data: { unitId: string }): void {
    const playerId = client.sessionId;
    const unit = this.state.units.get(data.unitId);
    if (!unit || unit.ownerId !== playerId || unit.status !== 'IDLE') return;

    startClaiming(this.state, data.unitId);
  }

  private findAvailableSpawnCell(): string | null {
    const terrainPriority = [BiomeType.Plains, BiomeType.Desert, BiomeType.Tundra];

    for (const terrain of terrainPriority) {
      for (const [cellId, cell] of this.state.cells) {
        if (cell.biome !== terrain) continue;
        if (cell.ownerId !== '') continue;

        const neighbors = this.adjacencyMap[cellId] ?? [];
        let adjacentToOtherPlayer = false;
        for (const nId of neighbors) {
          const nCell = this.state.cells.get(nId);
          if (nCell && nCell.ownerId !== '') {
            adjacentToOtherPlayer = true;
            break;
          }
        }

        if (adjacentToOtherPlayer) continue;

        let bufferOk = true;
        for (const nId of neighbors) {
          const nNeighbors = this.adjacencyMap[nId] ?? [];
          for (const nnId of nNeighbors) {
            const nnCell = this.state.cells.get(nnId);
            if (nnCell && nnCell.ownerId !== '') {
              bufferOk = false;
              break;
            }
          }
          if (!bufferOk) break;
        }

        if (bufferOk) return cellId;
      }
    }

    return null;
  }

  private countUnitsOnCell(cellId: string): number {
    let count = 0;
    for (const [, unit] of this.state.units) {
      if (unit.cellId === cellId) count++;
    }
    return count;
  }
}