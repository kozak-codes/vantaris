import { Room, Client, matchMaker } from '@colyseus/core';
import { MatchmakingState } from '../state/MatchmakingState';
import { GamePhase, QueueType } from '@vantaris/shared';
import { QUEUE_CONFIGS, COUNTDOWN_DURATION } from '@vantaris/shared/constants';
import {
  addPlayerToQueue,
  removePlayerFromQueue,
  startCountdown,
  resetCountdown,
  tickCountdown,
} from '../mutations/matchmaking';

interface CreateOptions {
  queueType?: string;
}

export class MatchmakingRoom extends Room<MatchmakingState> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  async onCreate(options: CreateOptions): Promise<void> {
    const queueType = (options.queueType || QueueType.QUICK) as QueueType;
    this.setState(new MatchmakingState());
    this.state.queueType = queueType;
    this.state.phase = GamePhase.WAITING;
    this.state.playerCount = 0;
    this.state.countdownSeconds = 0;

    this.setMetadata({ queueType });
  }

  async onJoin(client: Client): Promise<void> {
    addPlayerToQueue(this.state, client.sessionId);

    const config = QUEUE_CONFIGS[this.state.queueType as QueueType];

    if (this.state.playerCount >= config.maxPlayers) {
      await this.launchGame();
      return;
    }

    if (this.state.playerCount >= config.minPlayers && this.state.phase === GamePhase.WAITING) {
      startCountdown(this.state);
      this.startCountdownInterval();
    }

    this.broadcastState();
  }

  onLeave(client: Client, consented: boolean): void {
    removePlayerFromQueue(this.state, client.sessionId);

    const config = QUEUE_CONFIGS[this.state.queueType as QueueType];

    if (this.state.playerCount < config.minPlayers && this.state.phase === GamePhase.COUNTDOWN) {
      resetCountdown(this.state);
      this.clearCountdownInterval();
    }

    this.broadcastState();
  }

  onDispose(): void {
    this.clearCountdownInterval();
  }

  private startCountdownInterval(): void {
    if (this.countdownInterval) return;

    this.countdownInterval = setInterval(async () => {
      const remaining = tickCountdown(this.state);
      this.broadcastState();

      if (remaining <= 0) {
        this.clearCountdownInterval();
        await this.launchGame();
      }
    }, 1000);
  }

  private clearCountdownInterval(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private broadcastState(): void {
    this.broadcast('queueUpdate', {
      playerCount: this.state.playerCount,
      countdownSeconds: this.state.countdownSeconds,
      phase: this.state.phase,
    });
  }

  private async launchGame(): Promise<void> {
    const spawnPoints = this.generateSpawnPoints();
    const room = await matchMaker.createRoom('vantaris_room', {
      queueType: this.state.queueType,
      spawnPoints,
    });

    for (const client of this.clients) {
      client.send('gameReady', { roomId: room.roomId });
    }

    for (const client of this.clients) {
      client.leave();
    }
  }

  private generateSpawnPoints(): { cellId: string }[] {
    const playerCount = this.state.playerCount;
    const config = QUEUE_CONFIGS[this.state.queueType as QueueType];
    const totalCells = config.subdivideLevel === 3 ? 642 : 2562;
    const step = Math.floor(totalCells / playerCount);
    const spawnPoints: { cellId: string }[] = [];

    for (let i = 0; i < playerCount; i++) {
      spawnPoints.push({ cellId: `cell_${i * step}` });
    }

    return spawnPoints;
  }
}