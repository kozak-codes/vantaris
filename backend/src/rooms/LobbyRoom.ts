import { Client } from '@colyseus/core';
import { LobbyRoom as BaseLobbyRoom } from '@colyseus/core';

export class LobbyRoom extends BaseLobbyRoom {
  // Uses the built-in LobbyRoom from Colyseus
  // This provides per-room client counts automatically
  // Custom behavior will be added as needed in future phases
}