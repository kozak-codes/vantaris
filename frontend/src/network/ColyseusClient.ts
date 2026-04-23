import { Client, Room } from 'colyseus.js';
import { storeReconnectionToken, getReconnectionToken, getStoredRoomId } from './RoomPersistence';
import { applyStateSlice, clearClientState } from '../state/ClientState';

const SERVER_URL = 'ws://localhost:2567';

let client: Client | null = null;
let currentRoom: Room | null = null;

function getClient(): Client {
  if (!client) {
    client = new Client(SERVER_URL);
  }
  return client;
}

export async function joinLobby(): Promise<Room> {
  const c = getClient();
  return c.joinOrCreate('lobby_room');
}

export async function joinQueue(): Promise<Room> {
  const c = getClient();
  const room = await c.joinOrCreate('matchmaking');
  currentRoom = room;
  return room;
}

export async function leaveQueue(): Promise<void> {
  if (currentRoom) {
    await currentRoom.leave();
    currentRoom = null;
  }
}

export async function joinGame(roomId: string, displayName?: string): Promise<Room> {
  const c = getClient();
  const room = await c.joinById(roomId, { displayName: displayName || '' });
  currentRoom = room;
  if (room.reconnectionToken) {
    storeReconnectionToken(roomId, room.reconnectionToken);
  }
  localStorage.setItem('vantaris_currentRoom', roomId);

  room.onMessage('stateUpdate', (slice: any) => {
    applyStateSlice(slice);
  });

  room.onMessage('error', (data: any) => {
    console.warn('[vantaris] Server error:', data);
  });

  return room;
}

export async function reconnectToGame(roomId: string): Promise<Room> {
  const c = getClient();
  const token = getReconnectionToken(roomId);
  if (!token) {
    throw new Error('No reconnection token stored for room ' + roomId);
  }
  const room = await c.reconnect(token);
  currentRoom = room;

  room.onMessage('stateUpdate', (slice: any) => {
    applyStateSlice(slice);
  });

  room.onMessage('error', (data: any) => {
    console.warn('[vantaris] Server error:', data);
  });

  return room;
}

export function sendMoveUnit(unitId: string, targetCellId: string): void {
  if (currentRoom) {
    currentRoom.send('moveUnit', { unitId, targetCellId });
  }
}

export function sendSetUnitIdle(unitId: string): void {
  if (currentRoom) {
    currentRoom.send('setUnitIdle', { unitId });
  }
}

export function sendClaimTerritory(unitId: string): void {
  if (currentRoom) {
    currentRoom.send('claimTerritory', { unitId });
  }
}

export function sendToggleCityProduction(cityId: string, producing: boolean): void {
  if (currentRoom) {
    currentRoom.send('toggleCityProduction', { cityId, producing });
  }
}

export function sendUpdateCamera(qx: number, qy: number, qz: number, qw: number, zoom: number): void {
  if (currentRoom) {
    currentRoom.send('updateCamera', { qx, qy, qz, qw, zoom });
  }
}

export function getCurrentRoom(): Room | null {
  return currentRoom;
}

export function sendPing(): void {
  if (currentRoom) {
    currentRoom.send('ping');
  }
}

export function leaveGame(): void {
  if (currentRoom) {
    currentRoom.leave(true);
    currentRoom = null;
  }
  clearClientState();
}