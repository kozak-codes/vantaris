import { Client, Room } from 'colyseus.js';
import { storeReconnectionToken, getReconnectionToken } from './RoomPersistence';
import { applyStateSlice, clearClientState } from '../state/ClientState';
import { connected, lastTickTime } from '../state/signals';
import type { ChatMessage, ConstructionType } from '@vantaris/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';

let client: Client | null = null;
let currentRoom: Room | null = null;

export type ChatHandler = (msg: ChatMessage) => void;
const chatHandlers: ChatHandler[] = [];

export function onChatMessage(handler: ChatHandler): void {
  chatHandlers.push(handler);
}

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

function wireRoomMessages(room: Room): void {
  room.onMessage('stateUpdate', (slice: any) => {
    applyStateSlice(slice);
    lastTickTime.value = Date.now();
  });

  room.onMessage('error', (data: any) => {
    console.warn('[vantaris] Server error:', data);
  });

  room.onMessage('chatMessage', (data: ChatMessage) => {
    for (const handler of chatHandlers) {
      handler(data);
    }
  });
}

export async function joinGame(roomId: string, displayName?: string): Promise<Room> {
  const c = getClient();
  const room = await c.joinById(roomId, { displayName: displayName || '' });
  currentRoom = room;
  connected.value = true;
  if (room.reconnectionToken) {
    storeReconnectionToken(roomId, room.reconnectionToken);
  }
  localStorage.setItem('vantaris_currentRoom', roomId);
  wireRoomMessages(room);
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
  connected.value = true;
  wireRoomMessages(room);
  return room;
}

export function sendRenameCity(cityId: string, name: string): void {
  if (currentRoom) {
    currentRoom.send('renameCity', { cityId, name });
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

export function sendChatMessage(text: string): void {
  if (currentRoom) {
    currentRoom.send('chatMessage', { text });
  }
}

export function sendDirectMessage(targetId: string, text: string): void {
  if (currentRoom) {
    currentRoom.send('chatDirect', { targetId, text });
  }
}

export function leaveGame(): void {
  if (currentRoom) {
    currentRoom.leave(true);
    currentRoom = null;
  }
  connected.value = false;
  clearClientState();
}

export function sendBuild(macroCellId: string, subHexIndex: number, type: ConstructionType): void {
  if (currentRoom) {
    currentRoom.send('build', { macroCellId, subHexIndex, type });
  }
}

export function sendScrap(constructionId: string): void {
  if (currentRoom) {
    currentRoom.send('scrap', { constructionId });
  }
}

export function sendLand(bodyId: string): void {
  if (currentRoom) {
    currentRoom.send('landNow', { bodyId });
  }
}

export function sendLandAt(bodyId: string, cellId: string, subHexIndex: number): void {
  if (currentRoom) {
    currentRoom.send('landAt', { bodyId, cellId, subHexIndex });
  }
}