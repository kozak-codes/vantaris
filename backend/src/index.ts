import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { Encoder } from '@colyseus/schema';
import { VantarisRoom } from './rooms/VantarisRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { LobbyRoom } from './rooms/LobbyRoom';

Encoder.BUFFER_SIZE = 128 * 1024;

const PORT = parseInt(process.env.PORT || '2567', 10);

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.ALLOWED_ORIGIN ? [process.env.ALLOWED_ORIGIN] : []),
];

const app = express();
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

const server = createServer(app);
const transport = new WebSocketTransport({
  server,
});

const gameServer = new Server({
  transport,
});

gameServer.define('lobby_room', LobbyRoom);
gameServer.define('matchmaking', MatchmakingRoom);
gameServer.define('vantaris_room', VantarisRoom);

app.use('/colyseus', monitor(gameServer as any));

gameServer.listen(PORT).then(() => {
  console.log(`[vantaris] Colyseus server running on port ${PORT}`);
  console.log(`[vantaris] Monitor: http://localhost:${PORT}/colyseus`);
});

const GRACEFUL_SHUTDOWN_MS = 5000;

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[vantaris] Received ${signal}, shutting down gracefully...`);
  setTimeout(() => {
    console.log('[vantaris] Force exiting after timeout');
    process.exit(0);
  }, GRACEFUL_SHUTDOWN_MS);
  try {
    await gameServer.gracefullyShutdown(false);
  } catch (e) {
    // ignore
  }
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));