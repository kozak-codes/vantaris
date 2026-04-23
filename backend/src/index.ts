import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { monitor } from '@colyseus/monitor';
import { VantarisRoom } from './rooms/VantarisRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { LobbyRoom } from './rooms/LobbyRoom';
import { QueueType } from '@vantaris/shared';

const PORT = 2567;

const app = express();
app.use(cors({
  origin: ['http://localhost:5173'],
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
gameServer.define('matchmaking_quick', MatchmakingRoom, { queueType: QueueType.QUICK });
gameServer.define('matchmaking_standard', MatchmakingRoom, { queueType: QueueType.STANDARD });
gameServer.define('vantaris_room', VantarisRoom);

app.use('/colyseus', monitor(gameServer as any));

gameServer.listen(PORT).then(() => {
  console.log(`[vantaris] Colyseus server running on port ${PORT}`);
  console.log(`[vantaris] Monitor: http://localhost:${PORT}/colyseus`);
});