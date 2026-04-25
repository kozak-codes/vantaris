# Multiplayer & Server Architecture

## Room Types

### LobbyRoom

- Persistent Colyseus LobbyRoom, never auto-disposes
- Broadcasts queue counts every 2 seconds
- Source: [`backend/src/rooms/LobbyRoom.ts`](../backend/src/rooms/LobbyRoom.ts)

### MatchmakingRoom

- One per queue type
- Countdown launches VantarisRoom, sends all clients the new room ID
- Source: [`backend/src/rooms/MatchmakingRoom.ts`](../backend/src/rooms/MatchmakingRoom.ts)

### VantarisRoom

- Authoritative game room
- 100ms tick rate (`TICK_RATE_MS`)
- Per-player fog slices only — never broadcasts raw GameState
- Reconnection: `allowReconnection(client, 60)`
- Source: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts)

## Queue Configuration

| Queue | Min | Max | Subdivision |
|---|---|---|---|
| Current | 1 | 8 | Level 3 |

```typescript
// shared/src/constants.ts
export const QUEUE_CONFIG = {
  minPlayers: 1,
  maxPlayers: 8,
  subdivideLevel: 3,
};
```

Future queue types (Quick: 2–4 players level 3, Standard: 4–8 players level 4) not yet implemented.

## Per-Player State Slice

The server never broadcasts raw `GameState`. Each tick, for each connected client:

1. `computeVisibilityForPlayer()` — recalculates which cells are VISIBLE/REVEALED
2. `buildPlayerSlice()` — constructs a payload containing only:
   - `visibleCells` — full live data
   - `revealedCells` — frozen snapshots
   - `units` — only on visible cells
   - `cities` — only on visible cells
   - `players` — all players (name + color + alive status, no positional data)
   - `currentTick`, `myPlayerId`

Source: [`backend/src/mutations/fog.ts`](../backend/src/mutations/fog.ts)

## Client Messages

| Message | Direction | Data | Handler |
|---|---|---|---|
| `moveUnit` | Client → Server | `{ unitId, targetCellId }` | `handleMoveUnit()` |
| `setUnitIdle` | Client → Server | `{ unitId }` | `handleSetUnitIdle()` |
| `toggleCityProduction` | Client → Server | `{ cityId, producing }` | `handleToggleCityProduction()` |
| `claimTerritory` | Client → Server | `{ unitId }` | `handleClaimTerritory()` |
| `ping` | Client → Server | — | Returns `pong` with `serverTick` |
| `updateCamera` | Client → Server | `{ qx, qy, qz, qw, zoom }` | Stores for reconnect |
| `chatMessage` | Client → Server | `{ text }` | Global chat broadcast |
| `chatDirect` | Client → Server | `{ targetId, text }` | Direct message |
| `stateUpdate` | Server → Client | `PlayerStateSlice` | Full state replacement |
| `playerEliminated` | Server → Client | `{ playerId, displayName, color, eliminatedTick }` | Triggers elimination overlay |
| `gameWon` | Server → Client | `{ playerId, displayName, color }` | Triggers winner overlay |
| `error` | Server → Client | `{ type, code }` | Error feedback |
| `pong` | Server → Client | `{ serverTick }` | Ping response |
| `chatMessage` | Server → Client | `ChatMessage` | Chat message (global or direct) |

## Chat System

- **Global chat**: `chatMessage` message from client, server broadcasts to all players
- **Direct message**: `chatDirect` message with `targetId`, server sends to sender + target only
- **Message limit**: 200 characters max, trimmed server-side
- **Dead players**: Cannot send messages (server checks `player.alive`)
- **ChatMessage interface**: `{ id, senderId, senderName, senderColor, text, timestamp, targetId }` — `targetId` is `null` for global, player ID for direct
- **Client**: ChatPanel UI with Global/Direct tabs, DM per-conversation tabs, unread badge counters
- **Player List**: ✉ button per alive non-self player to open a DM

Source: [`frontend/src/network/ColyseusClient.ts`](../frontend/src/network/ColyseusClient.ts)

## URL & Persistence

- Room: `?room=roomId`
- Camera: `#cam=lat,lng,zoom`
- Session: `localStorage` by room ID
- Refresh = seamless reconnect

Source: [`frontend/src/network/RoomPersistence.ts`](../frontend/src/network/RoomPersistence.ts)

## Tick Loop

```typescript
// backend/src/systems/TickSystem.ts
// Interval: TICK_RATE_MS (100ms)

onTick(tick):
  1. processCityProduction(tick)  — spawn units if production complete
  2. processUnitMovement()        — step moving units along paths
  3. processClaimTimers()         — decrement claim timers, complete claims
  4. checkElimination()           — detect eliminated players (no cities), broadcast event
  5. broadcastPlayerSlices()      — send each player their visible state
  6. state.tick = tick
```

## Elimination & Win Detection

- A player is **eliminated** when they have zero cities
- On elimination: all their units are removed, `player.alive = false`, `playerEliminated` message broadcast to all clients
- Elimination overlay: Channel 66 broadcast style, 4 seconds, fades out
- When only one player remains alive: `gamePhase = FINISHED`, `gameWon` message broadcast
- Source: [`backend/src/rooms/VantarisRoom.ts`](../backend/src/rooms/VantarisRoom.ts) — `checkElimination()`

## Reconnection

- Server allows reconnection for `RECONNECTION_WINDOW = 60` seconds
- Client stores room ID in URL params and localStorage
- On page refresh, client attempts to reconnect to the same room
- Camera state is persisted per-player on the server (`cameraQuatX/Y/Z/W`, `cameraZoom`)