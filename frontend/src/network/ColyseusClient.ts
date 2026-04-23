import { Client, Room } from 'colyseus.js';
import { QueueType } from '@vantaris/shared';
import { storeSessionId, getSessionId } from './RoomPersistence';

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

export async function joinQueue(queueType: QueueType): Promise<Room> {
  const c = getClient();
  const roomName = queueType === QueueType.QUICK ? 'matchmaking_quick' : 'matchmaking_standard';
  const room = await c.joinOrCreate(roomName);
  currentRoom = room;
  return room;
}

export async function leaveQueue(): Promise<void> {
  if (currentRoom) {
    await currentRoom.leave();
    currentRoom = null;
  }
}

export async function joinGame(roomId: string): Promise<Room> {
  const c = getClient();
  const room = await c.joinById(roomId);
  currentRoom = room;
  // Store reconnection token for this room
  if (room.reconnectionToken) {
    storeSessionId(roomId, room.reconnectionToken);
  }
  return room;
}

export async function reconnect(roomId: string): Promise<Room> {
  const c = getClient();
  const reconnectionToken = getSessionId(roomId);
  if (!reconnectionToken) {
    throw new Error('No stored session for this room');
  }
  const room = await c.reconnect(reconnectionToken);
  currentRoom = room;
  return room;
}

export function sendExploreCell(cellId: string): void {
  if (currentRoom) {
    currentRoom.send('exploreCell', { cellId });
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