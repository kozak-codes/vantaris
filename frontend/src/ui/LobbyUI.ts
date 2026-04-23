import { QueueType } from '@vantaris/shared';
import {
  joinLobby,
  joinQueue,
  leaveQueue,
} from '../network/ColyseusClient';
import { setRoomIdInURL } from '../network/RoomPersistence';
import type { Room } from 'colyseus.js';

enum LobbyPhase {
  SELECT_QUEUE,
  WAITING,
  COUNTDOWN,
}

export class LobbyUI {
  private container: HTMLElement;
  private lobbyRoom: Room | null = null;
  private matchmakingRoom: Room | null = null;
  private phase: LobbyPhase = LobbyPhase.SELECT_QUEUE;
  private quickCount = 0;
  private standardCount = 0;
  private onGameReady: ((roomId: string) => void) | null = null;
  private onConnectionFailed: (() => void) | null = null;

  constructor() {
    this.container = document.getElementById('lobby-ui')!;
    this.show();
  }

  setOnGameReady(callback: (roomId: string) => void): void {
    this.onGameReady = callback;
  }

  setOnConnectionFailed(callback: () => void): void {
    this.onConnectionFailed = callback;
  }

  show(): void {
    this.container.classList.remove('hidden');
    this.renderSelectQueue();
    this.connectLobby();
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.disconnectLobby();
  }

  private async connectLobby(): Promise<void> {
    try {
      this.lobbyRoom = await joinLobby();
      this.lobbyRoom.onMessage('lobbyUpdate', (data: { quickCount: number; standardCount: number }) => {
        this.quickCount = data.quickCount;
        this.standardCount = data.standardCount;
        this.renderSelectQueue();
      });
    } catch {
      // Lobby connection failure is non-critical; show queue UI anyway
    }
  }

  private disconnectLobby(): void {
    if (this.lobbyRoom) {
      this.lobbyRoom.leave();
      this.lobbyRoom = null;
    }
  }

  private renderSelectQueue(): void {
    if (this.phase !== LobbyPhase.SELECT_QUEUE) return;

    this.container.innerHTML = `
      <div class="lobby-panel">
        <h1 class="lobby-title">VANTARIS</h1>
        <p class="lobby-subtitle">Choose a game mode</p>
        <div class="queue-options">
          <button id="btn-quick" class="queue-btn">
            <span class="queue-label">Quick Match</span>
            <span class="queue-info">2–4 players · Small globe</span>
            <span class="queue-count">${this.quickCount} in queue</span>
          </button>
          <button id="btn-standard" class="queue-btn">
            <span class="queue-label">Standard</span>
            <span class="queue-info">4–8 players · Large globe</span>
            <span class="queue-count">${this.standardCount} in queue</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-quick')?.addEventListener('click', () => this.handleQueueJoin(QueueType.QUICK));
    document.getElementById('btn-standard')?.addEventListener('click', () => this.handleQueueJoin(QueueType.STANDARD));
  }

  private async handleQueueJoin(queueType: QueueType): Promise<void> {
    try {
      this.phase = LobbyPhase.WAITING;
      this.matchmakingRoom = await joinQueue(queueType);

      this.matchmakingRoom.onMessage('queueUpdate', (data: { playerCount: number; countdownSeconds: number; phase: string }) => {
        this.renderWaiting(data.playerCount, data.countdownSeconds, data.phase);
      });

      this.matchmakingRoom.onMessage('gameReady', (data: { roomId: string }) => {
        setRoomIdInURL(data.roomId);
        this.hide();
        if (this.onGameReady) {
          this.onGameReady(data.roomId);
        }
      });

      this.renderWaiting(0, 0, 'WAITING');
    } catch {
      this.phase = LobbyPhase.SELECT_QUEUE;
      this.renderSelectQueue();
    }
  }

  private renderWaiting(playerCount: number, countdownSeconds: number, phase: string): void {
    const isCountdown = phase === 'COUNTDOWN' && countdownSeconds > 0;
    const statusText = isCountdown
      ? `Game starts in ${countdownSeconds}s`
      : 'Waiting for players...';

    this.container.innerHTML = `
      <div class="lobby-panel">
        <h2 class="lobby-waiting-title">${statusText}</h2>
        <p class="lobby-player-count">${playerCount} player${playerCount !== 1 ? 's' : ''} connected</p>
        <div class="lobby-spinner"></div>
        <button id="btn-cancel" class="cancel-btn">Cancel</button>
      </div>
    `;

    document.getElementById('btn-cancel')?.addEventListener('click', () => this.handleCancel());
  }

  private async handleCancel(): Promise<void> {
    await leaveQueue();
    this.matchmakingRoom = null;
    this.phase = LobbyPhase.SELECT_QUEUE;
    this.renderSelectQueue();
  }
}