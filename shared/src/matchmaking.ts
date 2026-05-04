const isDev = typeof process !== 'undefined' && (process.env.NODE_ENV === 'development' || process.env.VANTARIS_DEV === '1');

export const MATCHMAKING_CFG = {
  MAX_PLAYERS: 8,
  COUNTDOWN_SECONDS: isDev ? 3 : 60,
  RECONNECTION_WINDOW_MS: 60000,
} as const;