import { Room, Client } from '@colyseus/core';
import { matchMaker } from '@colyseus/core';

interface LobbyMessage {
  playerCount: number;
  countdownSeconds: number;
}

export class LobbyRoom extends Room {
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  async onCreate(): Promise<void> {
    this.autoDispose = false;

    this.broadcastInterval = setInterval(async () => {
      try {
        const rooms = await matchMaker.query({ name: 'matchmaking' });
        let playerCount = 0;
        for (const room of rooms) {
          playerCount += room.clients;
        }
        this.broadcast('lobbyUpdate', {
          playerCount,
          countdownSeconds: 0,
        });
      } catch {
        // query may fail if no rooms exist yet
      }
    }, 2000);
  }

  async onJoin(_client: Client): Promise<void> {
    // send current state immediately
    try {
      const rooms = await matchMaker.query({ name: 'matchmaking' });
      let playerCount = 0;
      for (const room of rooms) {
        playerCount += room.clients;
      }
      _client.send('lobbyUpdate', { playerCount, countdownSeconds: 0 });
    } catch {
      // ignore
    }
  }

  onLeave(_client: Client, _consented: boolean): void {
    // no special logic
  }

  onDispose(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }
}