import { GamePhase } from '@vantaris/shared';
import { MatchmakingState } from '../state/MatchmakingState';

export function addPlayerToQueue(state: MatchmakingState, playerId: string): void {
  state.playerCount++;
}

export function removePlayerFromQueue(state: MatchmakingState, playerId: string): void {
  if (state.playerCount > 0) {
    state.playerCount--;
  }
}

export function startCountdown(state: MatchmakingState): void {
  state.phase = GamePhase.COUNTDOWN;
}

export function resetCountdown(state: MatchmakingState): void {
  state.countdownSeconds = 0;
  state.phase = GamePhase.WAITING;
}