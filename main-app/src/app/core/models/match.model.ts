import { GameType } from './registration.model';

export type MatchStatus = 'pending' | 'played';

export interface MatchParticipant {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  poolId: string;
  gameType: GameType;
  participantA: MatchParticipant;
  participantB: MatchParticipant;
  status: MatchStatus;
  scores?: { a: number; b: number };
  winnerId?: string;
}

/**
 * Generates all round-robin match pairs from a list of participant IDs.
 * For N participants, produces N*(N-1)/2 pairs.
 * Returns pairs of indices into the participants array.
 */
export function generateRoundRobinPairs(participantIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      pairs.push([participantIds[i], participantIds[j]]);
    }
  }
  return pairs;
}
