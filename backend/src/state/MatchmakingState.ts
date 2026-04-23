import { Schema, type } from '@colyseus/schema';
import { GamePhase, QueueType } from '@vantaris/shared';

export class MatchmakingState extends Schema {
  @type('string') queueType: QueueType = QueueType.QUICK;
  @type('number') playerCount: number = 0;
  @type('number') countdownSeconds: number = 0;
  @type('string') phase: GamePhase = GamePhase.WAITING;
}