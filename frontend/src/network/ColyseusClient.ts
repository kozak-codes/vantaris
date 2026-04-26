import { Client, Room } from 'colyseus.js';
import { storeReconnectionToken, getReconnectionToken, getStoredRoomId } from './RoomPersistence';
import { applyStateSlice, clearClientState, clientState } from '../state/ClientState';
import type { ChatMessage } from '@vantaris/shared';

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

  room.onMessage('playerEliminated', (data: { playerId: string; displayName: string; color: string; eliminatedTick: number }) => {
    clientState.eliminationEvent = data;
  });

  room.onMessage('gameWon', (data: { playerId: string; displayName: string; color: string }) => {
    clientState.gameWonEvent = data;
  });

  room.onMessage('chatMessage', (data: ChatMessage) => {
    for (const handler of chatHandlers) {
      handler(data);
    }
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

  room.onMessage('playerEliminated', (data: { playerId: string; displayName: string; color: string; eliminatedTick: number }) => {
    clientState.eliminationEvent = data;
  });

  room.onMessage('gameWon', (data: { playerId: string; displayName: string; color: string }) => {
    clientState.gameWonEvent = data;
  });

  room.onMessage('chatMessage', (data: ChatMessage) => {
    for (const handler of chatHandlers) {
      handler(data);
    }
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

export function sendBuildStructure(unitId: string, buildingType: string, cellId: string): void {
  if (currentRoom) {
    currentRoom.send('buildStructure', { unitId, buildingType, cellId });
  }
}

export function sendRestoreRuin(unitId: string, cellId: string): void {
  if (currentRoom) {
    currentRoom.send('restoreRuin', { unitId, cellId });
  }
}

export function sendSetFactoryRecipe(buildingId: string, recipeId: string): void {
  if (currentRoom) {
    currentRoom.send('setFactoryRecipe', { buildingId, recipeId });
  }
}

export function sendCityQueueAddPriority(cityId: string, unitType: string): void {
  if (currentRoom) {
    currentRoom.send('cityQueueAddPriority', { cityId, unitType });
  }
}

export function sendCityQueueAddRepeat(cityId: string, unitType: string): void {
  if (currentRoom) {
    currentRoom.send('cityQueueAddRepeat', { cityId, unitType });
  }
}

export function sendCityQueueRemoveRepeat(cityId: string, index: number): void {
  if (currentRoom) {
    currentRoom.send('cityQueueRemoveRepeat', { cityId, index });
  }
}

export function sendCityQueueClearPriority(cityId: string): void {
  if (currentRoom) {
    currentRoom.send('cityQueueClearPriority', { cityId });
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
  clearClientState();
}