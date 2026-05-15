/**
 * A participant slot in a bracket match.
 */
export interface BracketParticipant {
  id: string;
  name: string;
  /** Pool ID the participant came from (used for anti-collision rule) */
  fromPool: string;
}

export type BracketMatchStatus = 'pending' | 'played' | 'bye';

/**
 * A single match node in the bracket tree.
 */
export interface BracketMatch {
  id: string;
  /** Round number (1 = first round, increases toward final) */
  round: number;
  /** Position within the round (1-based) */
  position: number;
  /** Participant A — null for a bye slot */
  participantA: BracketParticipant | null;
  /** Participant B — null for a bye slot */
  participantB: BracketParticipant | null;
  status: BracketMatchStatus;
  winnerId?: string;
  scores?: { a: number; b: number }[];
}

/**
 * The full bracket for a tournament.
 */
export interface Bracket {
  tournamentId: string;
  /** Total number of rounds (log2 of bracket size) */
  rounds: number;
  matches: BracketMatch[];
}
