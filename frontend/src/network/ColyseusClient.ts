import { Client, Room } from 'colyseus.js';
import { storeReconnectionToken, getReconnectionToken, getStoredRoomId } from './RoomPersistence';

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
  // Store room ID for reconnection after reload
  localStorage.setItem('vantaris_currentRoom', roomId);
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
  // Update token in case it changes
  if (room.reconnectionToken) {
    storeReconnectionToken(roomId, room.reconnectionToken);
  }
  return room;
}

export function sendExploreCell(cellId: string): void {
  if (currentRoom) {
    currentRoom.send('exploreCell', { cellId });
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
}