import { GameType } from './registration.model';

export type MatchStatus = 'pending' | 'played';

export interface MatchParticipant {
  id: string;
  name: string;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  poolId: string;
  gameType: GameType;
  participantA: MatchParticipant;
  participantB: MatchParticipant;
  status: MatchStatus;
  sets?: SetScore[];
  forfeitParticipantId?: string;
  winnerId?: string;
  /** @deprecated use sets instead */
  scores?: { a: number; b: number };
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

/**
 * Validates a single set score according to badminton rules:
 * - A set is won at 21+ points with at least 2 points of difference
 * - Exception: 30-29 is the maximum score (no 30-28 or similar)
 * - Scores must be non-negative integers
 *
 * Rules:
 * - One side must be the winner (higher score)
 * - Winner score must be >= 21
 * - Winner must lead by at least 2 points
 * - If either score is 30, it must be 30-29 (winner=30, loser=29)
 */
export function validateSet(a: number, b: number): boolean {
  // Both scores must be non-negative integers
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false;
  }

  // Both scores must be at most 30
  if (a > 30 || b > 30) {
    return false;
  }

  const winner = Math.max(a, b);
  const loser = Math.min(a, b);

  // The winner must have at least 21 points
  if (winner < 21) {
    return false;
  }

  // Special case: if winner has 30, loser must be exactly 29
  if (winner === 30) {
    return loser === 29;
  }

  // For scores between 21 and 29: winner must lead by at least 2
  return winner - loser >= 2;
}

/**
 * Determines who won a single set.
 * Returns 'A' if participantA won, 'B' if participantB won, null if invalid.
 */
export function determineSetWinner(a: number, b: number): 'A' | 'B' | null {
  if (!validateSet(a, b)) {
    return null;
  }
  return a > b ? 'A' : 'B';
}

export interface MatchValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a full match (array of sets) and optional forfeit.
 * - Best of 3 sets: first to win 2 sets wins
 * - At most 3 sets total
 * - No extra sets once a winner is determined
 * - If forfeit is set, no sets needed
 */
export function validateMatch(sets: SetScore[], forfeitParticipantId?: string): MatchValidationResult {
  // If forfeit, no need to validate sets (sets can be empty)
  if (forfeitParticipantId) {
    return { valid: true };
  }

  // Must have at least 1 set
  if (!sets || sets.length === 0) {
    return { valid: false, error: 'Au moins un set doit être saisi.' };
  }

  // Max 3 sets
  if (sets.length > 3) {
    return { valid: false, error: 'Un match ne peut pas dépasser 3 sets.' };
  }

  // Validate each set
  for (let i = 0; i < sets.length; i++) {
    if (!validateSet(sets[i].a, sets[i].b)) {
      return { valid: false, error: `Set ${i + 1} invalide (règles badminton non respectées).` };
    }
  }

  // Count wins per side
  let winsA = 0;
  let winsB = 0;
  for (const set of sets) {
    const winner = determineSetWinner(set.a, set.b);
    if (winner === 'A') winsA++;
    else if (winner === 'B') winsB++;
  }

  // Winner must have 2 sets won
  const matchWon = winsA >= 2 || winsB >= 2;
  if (!matchWon) {
    return { valid: false, error: 'Le match n\'est pas terminé (aucun joueur n\'a gagné 2 sets).' };
  }

  // Check we didn't play extra sets after a winner was determined
  let runningA = 0;
  let runningB = 0;
  for (let i = 0; i < sets.length; i++) {
    const winner = determineSetWinner(sets[i].a, sets[i].b);
    if (winner === 'A') runningA++;
    else if (winner === 'B') runningB++;

    // If winner reached 2 before last set, extra sets were played
    if ((runningA >= 2 || runningB >= 2) && i < sets.length - 1) {
      return { valid: false, error: 'Des sets ont été joués après la fin du match.' };
    }
  }

  return { valid: true };
}

/**
 * Determines the winner of a match (best of 3 sets).
 * Returns participantA's ID if A wins, participantB's ID if B wins.
 * If forfeit is set, the other participant wins.
 */
export function determineMatchWinner(
  sets: SetScore[],
  participantAId: string,
  participantBId: string,
  forfeitParticipantId?: string
): string | null {
  // Forfeit: the non-forfeiting participant wins
  if (forfeitParticipantId) {
    if (forfeitParticipantId === participantAId) return participantBId;
    if (forfeitParticipantId === participantBId) return participantAId;
    return null;
  }

  const validation = validateMatch(sets);
  if (!validation.valid) return null;

  let winsA = 0;
  let winsB = 0;
  for (const set of sets) {
    const winner = determineSetWinner(set.a, set.b);
    if (winner === 'A') winsA++;
    else if (winner === 'B') winsB++;
  }

  if (winsA >= 2) return participantAId;
  if (winsB >= 2) return participantBId;
  return null;
}
