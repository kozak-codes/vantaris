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
  HOW_TO_PLAY,
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
    this.renderNameEntry(getDisplayName());
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
        this.updateQueueCount();
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

  private updateQueueCount(): void {
    const el = document.getElementById('queue-count');
    if (el) {
      el.textContent = `${this.playerCount} player${this.playerCount !== 1 ? 's' : ''} in queue`;
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
        <p id="queue-count" class="lobby-queue-count">${this.playerCount} player${this.playerCount !== 1 ? 's' : ''} in queue</p>
        <div class="lobby-links">
          <a href="javascript:void(0)" id="btn-how-to-play" class="lobby-link">How to Play</a>
          <a href="https://github.com/kozak-codes/vantaris" target="_blank" rel="noopener" class="lobby-link">GitHub</a>
        </div>
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

    document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
      this.renderHowToPlay();
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

  private renderHowToPlay(): void {
    this.container.innerHTML = `
      <div class="lobby-panel how-to-play-panel">
        <h2 class="lobby-title" style="font-size:22px;margin-bottom:12px">How to Play</h2>
        <div class="htp-section">
          <h3>Goal</h3>
          <p>Expand your territory, build cities and factories, and eliminate all opponents.</p>
        </div>
        <div class="htp-section">
          <h3>Units</h3>
          <p><b>Infantry</b> — Captures territory. Can build farms, mines, and lumber camps.</p>
          <p><b>Engineers</b> — Builds everything infantry can, plus oil wells, factories, and cities.</p>
          <p>Select a unit, then click a tile to move or claim it.</p>
        </div>
        <div class="htp-section">
          <h3>Economy</h3>
          <p>Extractors (farms, mines, etc.) produce raw resources each tick.</p>
          <p>Resources flow automatically to the nearest city or factory within 6 hexes.</p>
          <p>Factories process raw resources into goods (grain → bread, ore → steel, etc.).</p>
          <p>Use the <b>Deliver To</b> dropdown to route extractor/factory output to a specific target.</p>
        </div>
        <div class="htp-section">
          <h3>Factory Specialization</h3>
          <p>Factories start very slow. Each production cycle makes them faster at their current recipe (+12% speed per cycle).</p>
          <p>Switching recipes resets specialization progress.</p>
        </div>
        <div class="htp-section">
          <h3>Cities</h3>
          <p>Cities grow population when fed. Population determines production queue slots and garrison capacity.</p>
          <p>Build units from the city panel's production queue.</p>
        </div>
        <div class="htp-section">
          <h3>Combat</h3>
          <p>Move units onto enemy territory to claim it. Enemies lose territory and resources when their cells are captured.</p>
        </div>
        <button id="btn-back-lobby" class="cancel-btn" style="margin-top:12px">← Back</button>
      </div>
    `;

    document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
      this.phase = LobbyPhase.NAME_ENTRY;
      this.renderNameEntry(getDisplayName());
    });
  }

  private async handleCancel(): Promise<void> {
    await leaveQueue();
    this.matchmakingRoom = null;
    this.phase = LobbyPhase.NAME_ENTRY;
    this.renderNameEntry(getDisplayName());
  }
}