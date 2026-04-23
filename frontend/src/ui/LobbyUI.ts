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
  private playerCount = 0;
  private onGameReady: ((roomId: string) => void) | null = null;

  constructor() {
    this.container = document.getElementById('lobby-ui')!;
    this.show();
  }

  setOnGameReady(callback: (roomId: string) => void): void {
    this.onGameReady = callback;
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
      this.lobbyRoom.onMessage('lobbyUpdate', (data: { playerCount: number }) => {
        this.playerCount = data.playerCount;
        this.render();
      });
    } catch {
      // lobby connection failure is non-critical
    }
  }

  private disconnectLobby(): void {
    if (this.lobbyRoom) {
      this.lobbyRoom.leave();
      this.lobbyRoom = null;
    }
  }

  private render(): void {
    if (this.phase === LobbyPhase.SELECT_QUEUE) {
      this.renderSelectQueue();
    } else {
      // WAITING or COUNTDOWN handled by queueUpdate messages
    }
  }

  private renderSelectQueue(): void {
    this.container.innerHTML = `
      <div class="lobby-panel">
        <h1 class="lobby-title">VANTARIS</h1>
        <p class="lobby-subtitle">Hex-globe strategy</p>
        <div class="queue-options">
          <button id="btn-quick" class="queue-btn">
            <span class="queue-label">Quick Match</span>
            <span class="queue-info">1–8 players · Globe scales with players</span>
            <span class="queue-count">${this.playerCount} in queue</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-quick')?.addEventListener('click', () => this.handleQueueJoin());
  }

  private async handleQueueJoin(): Promise<void> {
    try {
      this.phase = LobbyPhase.WAITING;
      this.matchmakingRoom = await joinQueue();

      this.matchmakingRoom.onMessage('queueUpdate', (data: { playerCount: number; countdownSeconds: number; phase: string }) => {
        this.playerCount = data.playerCount;
        this.renderWaiting(data.playerCount, data.countdownSeconds);
      });

      this.matchmakingRoom.onMessage('gameReady', (data: { roomId: string }) => {
        setRoomIdInURL(data.roomId);
        this.hide();
        if (this.onGameReady) {
          this.onGameReady(data.roomId);
        }
      });

      this.renderWaiting(this.playerCount, 0);
    } catch {
      this.phase = LobbyPhase.SELECT_QUEUE;
      this.renderSelectQueue();
    }
  }

  private renderWaiting(playerCount: number, countdownSeconds: number): void {
    const isCountdown = countdownSeconds > 0;
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