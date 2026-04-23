import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { VantarisRoom } from './rooms/VantarisRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { LobbyRoom } from './rooms/LobbyRoom';

const PORT = 2567;

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
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