import { GameType } from './registration.model';

/**
 * Statistics for a player in a specific game type.
 */
export interface GameTypeStats {
  gameType: GameType;
  played: number;
  wins: number;
  losses: number;
  /** Win rate as a percentage rounded to 1 decimal place (e.g. 66.7) */
  winRate: number;
}

/**
 * A player's final result in a tournament.
 */
export interface TournamentResult {
  tournamentId: string;
  name: string;
  date: string;
  /** Final rank achieved (1 = champion, 2 = finalist, etc.) */
  finalRank: number;
  /** Whether the rank was determined from pool phase or bracket phase */
  phase: 'pool' | 'bracket';
}

/**
 * Aggregated statistics for a single player.
 */
export interface PlayerStats {
  playerId: string;
  global: {
    played: number;
    wins: number;
    losses: number;
    /** Win rate as a percentage rounded to 1 decimal place */
    winRate: number;
  };
  byGameType: GameTypeStats[];
  tournaments: TournamentResult[];
}
