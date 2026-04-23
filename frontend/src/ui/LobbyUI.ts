import {
  joinLobby,
  joinQueue,
  leaveQueue,
} from '../network/ColyseusClient';
import { setRoomIdInURL, getDisplayName, setDisplayName } from '../network/RoomPersistence';
import type { Room } from 'colyseus.js';

enum LobbyPhase {
  NAME_ENTRY,
  WAITING,
}

export class LobbyUI {
  private container: HTMLElement;
  private lobbyRoom: Room | null = null;
  private matchmakingRoom: Room | null = null;
  private phase: LobbyPhase = LobbyPhase.NAME_ENTRY;
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
    const savedName = getDisplayName();
    if (savedName) {
      this.phase = LobbyPhase.NAME_ENTRY;
      this.renderNameEntry(savedName);
      // auto-advance if name already saved
    } else {
      this.renderNameEntry('');
    }
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
        if (this.phase === LobbyPhase.NAME_ENTRY) {
          this.renderNameEntry(getDisplayName());
        }
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

  private renderNameEntry(prefill: string = ''): void {
    this.container.innerHTML = `
      <div class="lobby-panel">
        <h1 class="lobby-title">VANTARIS</h1>
        <p class="lobby-subtitle">Hex-globe strategy</p>
        <div class="name-entry">
          <label class="name-label" for="name-input">Your name</label>
          <input type="text" id="name-input" class="name-input" placeholder="Enter your name" maxlength="24" value="${prefill}" autocomplete="off" />
          <button id="btn-play" class="play-btn">Quick Match</button>
        </div>
        <p class="lobby-queue-count">${this.playerCount} player${this.playerCount !== 1 ? 's' : ''} in queue</p>
      </div>
    `;

    const input = document.getElementById('name-input') as HTMLInputElement;
    const btn = document.getElementById('btn-play');

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btn?.click();
      }
    });

    btn?.addEventListener('click', () => {
      const name = input?.value.trim() || '';
      setDisplayName(name);
      this.handleQueueJoin(name);
    });

    input?.focus();
  }

  private async handleQueueJoin(displayName: string): Promise<void> {
    this.phase = LobbyPhase.WAITING;
    try {
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
      this.phase = LobbyPhase.NAME_ENTRY;
      this.renderNameEntry(displayName);
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
    this.phase = LobbyPhase.NAME_ENTRY;
    this.renderNameEntry(getDisplayName());
  }
}