import { Room, Client, matchMaker } from '@colyseus/core';
import { GameState } from '../state/GameState';
import { GamePhase, BiomeType, FogVisibility } from '@vantaris/shared';
import { QUEUE_CONFIG, STARTING_TERRITORY_SIZE, VISION_RANGE, RECONNECTION_WINDOW } from '@vantaris/shared/constants';
import { generateGlobe } from '../globe';
import { revealCellForPlayer, computeVisibilityForPlayer, snapshotAndHideCell } from '../mutations/fog';
import { claimCell } from '../mutations/territory';
import { CellState } from '../state/CellState';
import { PlayerState } from '../state/PlayerState';

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
  private adjacency: Map<string, string[]> = new Map();

  async onCreate(options: CreateOptions): Promise<void> {
    const playerCount = options.spawnPoints?.length || 1;
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    this.maxClients = QUEUE_CONFIG.maxPlayers;
    const globe = generateGlobe(subdivideLevel);

    this.setState(new GameState());

    for (const cell of globe.cells) {
      const cellState = new CellState();
      cellState.cellId = cell.id;
      cellState.biome = cell.biome;
      cellState.ownerId = '';
      this.state.cells.set(cell.id, cellState);
    }

    this.adjacency = globe.adjacency;

    // Store neighbor info on each cell for quick lookup
    for (const cell of globe.cells) {
      const cs = this.state.cells.get(cell.id);
      if (cs) {
        (cs as any)._neighbors = cell.neighborIds;
      }
    }

    this.state.phase = GamePhase.ACTIVE;

    this.onMessage('exploreCell', (client, { cellId }: { cellId: string }) => {
      this.handleExploreCell(client, cellId);
    });

    this.onMessage('ping', (client) => {
      client.send('pong', { timestamp: Date.now() });
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

    const spawnCellId = options?.spawnPoint || this.findAvailableSpawnCell();
    if (spawnCellId) {
      const cluster = this.findClusterAroundCell(spawnCellId, STARTING_TERRITORY_SIZE);
      for (const cid of cluster) {
        claimCell(this.state, playerId, cid);
      }
    }

    this.state.players.set(playerId, player);

    computeVisibilityForPlayer(this.state, playerId, VISION_RANGE);

    const slice = this.computePlayerSlice(playerId);
    client.send('stateUpdate', slice);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    if (consented) return;
    try {
      await this.allowReconnection(client, RECONNECTION_WINDOW);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        const slice = this.computePlayerSlice(client.sessionId);
        client.send('stateUpdate', slice);
      }
    } catch {
      // reconnection timeout — player stays but disconnected
    }
  }

  onDispose(): void {
    // cleanup
  }

  private handleExploreCell(client: Client, cellId: string): void {
    const playerId = client.sessionId;
    const player = this.state.players.get(playerId);
    if (!player) return;

    const cell = this.state.cells.get(cellId);
    if (!cell) return;

    let adjacent = false;
    for (const [cid, cs] of this.state.cells) {
      if (cs.ownerId === playerId) {
        const neighbors = (cs as any)._neighbors as string[];
        if (neighbors && neighbors.includes(cellId)) {
          adjacent = true;
          break;
        }
      }
    }

    if (!adjacent) return;

    claimCell(this.state, playerId, cellId);

    this.broadcastStateUpdate(playerId);
  }

  private broadcastStateUpdate(playerId: string): void {
    const client = this.clients.find(c => c.sessionId === playerId);
    if (!client) return;

    const slice = this.computePlayerSlice(playerId);
    client.send('stateUpdate', slice);
  }

  private computePlayerSlice(playerId: string) {
    const player = this.state.players.get(playerId);
    if (!player) return { visibleCells: [], revealedCells: [], players: [] };

    const visibleCells: any[] = [];
    const revealedCells: any[] = [];

    for (const [cellId, fogValue] of player.fog.visibility) {
      if (fogValue === FogVisibility.VISIBLE) {
        const cell = this.state.cells.get(cellId);
        if (cell) {
          visibleCells.push({
            cellId: cell.cellId,
            biome: cell.biome,
            ownerId: cell.ownerId,
          });
        }
      } else if (fogValue === FogVisibility.REVEALED) {
        const snapshot = player.fog.getSnapshot(cellId);
        if (snapshot) {
          revealedCells.push({
            ...JSON.parse(snapshot),
            cellId,
          });
        }
      }
    }

    const players: any[] = [];
    for (const [pid, ps] of this.state.players) {
      players.push({
        playerId: ps.playerId,
        displayName: ps.displayName,
        color: ps.color,
        territoryCellCount: ps.territoryCellCount,
      });
    }

    return {
      visibleCells,
      revealedCells,
      players,
      camera: {
        qx: player.cameraQuatX,
        qy: player.cameraQuatY,
        qz: player.cameraQuatZ,
        qw: player.cameraQuatW,
        zoom: player.cameraZoom,
      },
    };
  }

  private findAvailableSpawnCell(): string {
    for (const [cellId, cell] of this.state.cells) {
      if (cell.ownerId === '') {
        return cellId;
      }
    }
    return this.state.cells.keys().next().value || 'cell_0';
  }

  private findClusterAroundCell(startCellId: string, size: number): string[] {
    const visited: string[] = [startCellId];
    const queue: string[] = [startCellId];

    while (visited.length < size && queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.adjacency.get(current) ?? [];
      for (const n of neighbors) {
        if (!visited.includes(n)) {
          const cell = this.state.cells.get(n);
          if (cell && cell.ownerId === '') {
            visited.push(n);
            queue.push(n);
            if (visited.length >= size) break;
          }
        }
        if (visited.length >= size) break;
      }
    }

    return visited;
  }
}