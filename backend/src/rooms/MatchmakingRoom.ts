import { Room, Client, matchMaker } from '@colyseus/core';
import { MatchmakingState } from '../state/MatchmakingState';
import { GamePhase, QueueType } from '@vantaris/shared';
import { MATCHMAKING_CFG } from '@vantaris/shared/constants';
import {
  addPlayerToQueue,
  removePlayerFromQueue,
  startCountdown,
  resetCountdown,
} from '../mutations/matchmaking';

export class MatchmakingRoom extends Room<MatchmakingState> {
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private secondsRemaining = 0;

  async onCreate(): Promise<void> {
    this.setState(new MatchmakingState());
    this.state.queueType = QueueType.QUICK;
    this.state.phase = GamePhase.WAITING;
    this.state.playerCount = 0;
    this.state.countdownSeconds = 0;
  }

  async onJoin(client: Client): Promise<void> {
    addPlayerToQueue(this.state, client.sessionId);
    this.startTickInterval();
    this.broadcastState();
  }

  onLeave(client: Client, consented: boolean): void {
    removePlayerFromQueue(this.state, client.sessionId);

    if (this.state.playerCount < 1) {
      this.clearTickInterval();
      resetCountdown(this.state);
    }

    this.broadcastState();
  }

  onDispose(): void {
    this.clearTickInterval();
  }

  private startTickInterval(): void {
    if (this.tickInterval) return;
    this.secondsRemaining = MATCHMAKING_CFG.COUNTDOWN_SECONDS;
    startCountdown(this.state);
    this.state.countdownSeconds = this.secondsRemaining;

    this.tickInterval = setInterval(() => {
      this.secondsRemaining--;
      this.state.countdownSeconds = this.secondsRemaining;
      this.broadcastState();

      if (this.secondsRemaining <= 0) {
        this.clearTickInterval();
        this.launchGame();
      }
    }, 1000);
  }

  private clearTickInterval(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
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
    const playerCount = this.state.playerCount;
    const spawnPoints = this.generateSpawnPoints(playerCount);

    const room = await matchMaker.createRoom('vantaris_room', {
      spawnPoints,
    });

    for (const client of this.clients) {
      client.send('gameReady', { roomId: room.roomId });
    }

    for (const client of this.clients) {
      client.leave();
    }
  }

  private generateSpawnPoints(playerCount: number): { cellId: string }[] {
    const subdivideLevel = playerCount > 4 ? 4 : 3;
    const totalCells = subdivideLevel === 3 ? 642 : 2562;
    const step = Math.floor(totalCells / playerCount);
    const spawnPoints: { cellId: string }[] = [];

    for (let i = 0; i < playerCount; i++) {
      spawnPoints.push({ cellId: `cell_${i * step}` });
    }

    return spawnPoints;
  }
}