import { GameType } from './registration.model';

/**
 * A pool (groupe) within a tournament for a given game type.
 *
 * memberIds holds player IDs for singles game types.
 * For doubles/mixte game types, memberIds also holds player IDs (not pair IDs) because
 * PairingService (issue-11) is not yet merged. Each pair counts as one unit for the
 * max-4-teams-per-pool cap, meaning max 8 player IDs per doubles pool.
 * TODO (post issue-11 merge): migrate doubles memberIds to pairingIds.
 *
 * Max capacities:
 *   - Singles (simple-*):      max 5 players per pool
 *   - Doubles/Mixte (double-*, double-mixte): max 4 teams (pairs) per pool
 */
export interface Pool {
  id: string;
  tournamentId: string;
  gameType: GameType;
  poolNumber: number;
  memberIds: string[];
  locked: boolean;
}

/**
 * Determines if a game type is a doubles/mixte type.
 */
export function isDoubleGameType(gameType: GameType): boolean {
  return gameType.startsWith('double-');
}

/**
 * Returns the max number of participants per pool for a given game type.
 * - Singles: 5 players
 * - Doubles/Mixte: 4 teams (pairs), but since we store player IDs, cap is 8 player IDs
 *   (2 players per pair × 4 pairs)
 *
 * Note: for singles the cap applies directly to memberIds.length.
 * For doubles the caller is responsible for ensuring pairs are formed before calling generatePools.
 */
export function maxPerPool(gameType: GameType): number {
  return isDoubleGameType(gameType) ? 4 : 5;
}
