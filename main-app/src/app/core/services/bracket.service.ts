import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  getDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { BracketMatch, BracketParticipant } from '../models/bracket.model';
import { PoolStanding } from '../models/standings.model';
import { Pool } from '../models/pool.model';
import { Match, SetScore, validateMatch, determineMatchWinner } from '../models/match.model';
import { PoolConfig } from '../models/tournament.model';

// ============================================================
// Pure functions (exported for testing)
// ============================================================

/**
 * Returns the smallest power of 2 that is >= n.
 */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Computes the number of byes needed for a bracket of bracketSize slots
 * when there are qualifierCount actual participants.
 */
export function computeByes(qualifierCount: number, bracketSize: number): number {
  return bracketSize - qualifierCount;
}

/**
 * A qualified participant enriched with their global ranking information.
 */
export interface RankedQualifier {
  id: string;
  name: string;
  poolId: string;
  /** Pool-internal rank */
  poolRank: number;
  /** Total points in pool */
  totalPoints: number;
  /** Set difference in pool */
  setDiff: number;
  /** Point difference in pool */
  pointDiff: number;
}

/**
 * Collects qualified participants from standings across all pools,
 * sorted by global ranking (poolRank asc → totalPoints desc → setDiff desc → pointDiff desc → name).
 *
 * @param pools - All pools for the tournament
 * @param standingsByPool - Map of poolId → PoolStanding[]
 * @param poolConfig - Tournament pool config (to read qualifiersPerPool)
 */
export function collectQualifiers(
  pools: Pool[],
  standingsByPool: Map<string, PoolStanding[]>,
  poolConfig: PoolConfig[]
): RankedQualifier[] {
  const qualifiers: RankedQualifier[] = [];

  for (const pool of pools) {
    const config = poolConfig.find((c) => c.gameType === pool.gameType);
    const qualifiersPerPool = config?.qualifiersPerPool ?? 1;
    if (qualifiersPerPool === 0) continue;

    const standings = standingsByPool.get(pool.id) ?? [];
    const sorted = [...standings].sort((a, b) => a.rank - b.rank);

    for (let i = 0; i < qualifiersPerPool && i < sorted.length; i++) {
      const s = sorted[i];
      qualifiers.push({
        id: s.participantId,
        name: s.name,
        poolId: pool.id,
        poolRank: s.rank,
        totalPoints: s.totalPoints,
        setDiff: s.setsWon - s.setsLost,
        pointDiff: s.pointsScored - s.pointsConceded,
      });
    }
  }

  // Sort by global ranking: poolRank asc (1st > 2nd), then totalPoints desc,
  // then setDiff desc, then pointDiff desc, then name asc.
  qualifiers.sort((a, b) => {
    if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return a.name.localeCompare(b.name);
  });

  return qualifiers;
}

/**
 * Builds the standard seeded bracket slot list of length `bracketSize`.
 *
 * In the classic single-elimination seeding:
 *   - Seed 1 faces seed bracketSize in R1
 *   - Seed 2 faces seed bracketSize-1 in R1
 *   - etc.
 *
 * So the slot order (each pair = one R1 match) is:
 *   [1, bracketSize, bracketSize/2+1, bracketSize/2, ...]
 * arranged recursively so top seeds meet only in later rounds.
 *
 * When bracketSize > qualifierCount:
 *   - Seeds > qualifierCount are byes
 *   - Seed 1 is paired with seed bracketSize (a bye) → seed 1 gets a bye
 *   - Seed 2 is paired with seed bracketSize-1 (a bye) → seed 2 gets a bye
 *
 * Returns an array where index = slot (0-based), value = seed (1-based).
 */
export function buildSeedPositions(bracketSize: number): number[] {
  // Build match pairs recursively:
  // A single-elim bracket of n has these first-round pairs (seeds sum to n+1):
  //   (1, n), (n/2+1, n/2), (n/4+1, 3n/4), ...
  //
  // Implementation: start with [1, 2] and recursively double by inserting
  // opponents: each existing seed s gets opponent (groupSize+1 - s) in its group.
  let slots: number[] = [1, 2];
  let groupSize = 2;

  while (slots.length < bracketSize) {
    groupSize *= 2;
    const next: number[] = [];
    // Each pair in current `slots` (0,1), (2,3), ... expands to two pairs
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      // a's opponent at this level: groupSize + 1 - a
      // b's opponent at this level: groupSize + 1 - b
      next.push(a, groupSize + 1 - a, groupSize + 1 - b, b);
    }
    slots = next;
  }

  return slots;
}

/**
 * Seeds the bracket: assigns qualified participants to R1 match slots,
 * attributing byes to the best-ranked participants,
 * and resolving intra-pool collisions in R1 by swapping adjacent positions.
 *
 * The classic bracket places seed 1 in slot 0, which is paired with slot 1
 * (= seed bracketSize). If bracketSize > qualifierCount, seed bracketSize is a bye,
 * so seed 1 gets a bye. Same for seed 2.
 *
 * Returns a list of BracketMatch for round 1 only.
 */
export function seedBracket(
  qualifiers: RankedQualifier[],
  bracketSize: number
): BracketMatch[] {
  const matchCount = bracketSize / 2;

  // Build seed positions: slotToSeed[slotIndex] = seed (1-based)
  const slotToSeed = buildSeedPositions(bracketSize);

  // Map seed → qualifier:
  //   seeds 1..qualifiers.length → real participants (index = seed - 1)
  //   seeds > qualifiers.length → null (bye slot)
  // Since slotToSeed mirrors seed 1 with seed bracketSize, seed bracketSize will
  // be a bye when bracketSize > qualifierCount, so seed 1 (best) gets a bye.
  const seedToQualifier = new Map<number, RankedQualifier | null>();
  for (let s = 1; s <= bracketSize; s++) {
    seedToQualifier.set(s, s <= qualifiers.length ? qualifiers[s - 1] : null);
  }

  // Build R1 matches: pair adjacent slots (0,1), (2,3), ...
  const matches: BracketMatch[] = [];
  for (let pos = 0; pos < matchCount; pos++) {
    const slotA = pos * 2;
    const slotB = pos * 2 + 1;
    const qA = seedToQualifier.get(slotToSeed[slotA]) ?? null;
    const qB = seedToQualifier.get(slotToSeed[slotB]) ?? null;
    matches.push(buildR1Match(pos + 1, qA, qB));
  }

  // Anti-collision: resolve any intra-pool match-ups in R1
  resolveIntraPoolCollisions(matches, bracketSize);

  return matches;
}

function buildR1Match(
  position: number,
  qA: RankedQualifier | null,
  qB: RankedQualifier | null
): BracketMatch {
  const pA: BracketParticipant | null = qA
    ? { id: qA.id, name: qA.name, fromPool: qA.poolId }
    : null;
  const pB: BracketParticipant | null = qB
    ? { id: qB.id, name: qB.name, fromPool: qB.poolId }
    : null;

  const isBye = pA === null || pB === null;

  return {
    id: `r1-m${position}`,
    round: 1,
    position,
    participantA: pA,
    participantB: pB,
    status: isBye ? 'bye' : 'pending',
    winnerId: isBye
      ? (pA ? pA.id : pB ? pB.id : undefined)
      : undefined,
  };
}

/**
 * Resolves intra-pool collisions in R1 by swapping participantB of colliding
 * matches with participantB of the next non-colliding match that fixes it.
 * Modifies matches in place.
 */
export function resolveIntraPoolCollisions(matches: BracketMatch[], bracketSize: number): void {
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m.participantA || !m.participantB) continue; // bye match, skip
    if (m.participantA.fromPool === m.participantB.fromPool) {
      // Find another match to swap with
      let swapped = false;
      for (let j = i + 1; j < matches.length; j++) {
        const other = matches[j];
        // Try swapping participantB of m with participantB of other
        if (other.participantB && other.participantB.fromPool !== m.participantA.fromPool &&
            (!other.participantA || other.participantA.fromPool !== m.participantB.fromPool)) {
          // Swap
          const tmp = m.participantB;
          m.participantB = other.participantB;
          other.participantB = tmp;
          // Re-check bye status for both
          m.status = 'pending';
          other.status = (other.participantA && other.participantB) ? 'pending' : 'bye';
          swapped = true;
          break;
        }
        // Try swapping participantA of other
        if (other.participantA && other.participantA.fromPool !== m.participantA.fromPool &&
            other.participantB?.fromPool !== m.participantB.fromPool) {
          const tmp = m.participantB;
          m.participantB = other.participantA;
          other.participantA = tmp;
          m.status = 'pending';
          other.status = (other.participantA && other.participantB) ? 'pending' : 'bye';
          swapped = true;
          break;
        }
      }
      // If no swap found, we leave as is (can't always guarantee no collision)
    }
  }
}

/**
 * Generates subsequent round placeholders (rounds 2..totalRounds).
 * These are empty matches waiting for winners to be filled in.
 */
export function generateSubsequentRounds(bracketSize: number): BracketMatch[] {
  const totalRounds = Math.log2(bracketSize);
  const matches: BracketMatch[] = [];

  for (let round = 2; round <= totalRounds; round++) {
    const matchCount = bracketSize / Math.pow(2, round);
    for (let pos = 1; pos <= matchCount; pos++) {
      matches.push({
        id: `r${round}-m${pos}`,
        round,
        position: pos,
        participantA: null,
        participantB: null,
        status: 'pending',
      });
    }
  }

  return matches;
}

/**
 * Propagates bye winners into subsequent rounds.
 * Modifies matches in place.
 * Should be called after all R1 matches are built (including byes).
 */
export function propagateByes(matches: BracketMatch[]): void {
  // Sort matches so we process earlier rounds first
  const sorted = [...matches].sort((a, b) => a.round - b.round || a.position - b.position);

  // Build a map for quick lookup: round+position → match
  const matchMap = new Map<string, BracketMatch>();
  for (const m of matches) {
    matchMap.set(`r${m.round}-m${m.position}`, m);
  }

  for (const match of sorted) {
    if (match.status !== 'bye' || !match.winnerId) continue;

    // Find winner participant info
    const winner = match.participantA?.id === match.winnerId
      ? match.participantA
      : match.participantB;

    if (!winner) continue;

    // Calculate next round slot
    const nextRound = match.round + 1;
    const nextPosition = Math.ceil(match.position / 2);
    const nextMatch = matchMap.get(`r${nextRound}-m${nextPosition}`);

    if (!nextMatch) continue;

    // If P is odd → fills participantA slot; if P is even → fills participantB slot
    if (match.position % 2 === 1) {
      nextMatch.participantA = { id: winner.id, name: winner.name, fromPool: winner.fromPool };
    } else {
      nextMatch.participantB = { id: winner.id, name: winner.name, fromPool: winner.fromPool };
    }

    // If the next match now has both participants as byes-winners, it becomes a bye too
    if (nextMatch.participantA && nextMatch.participantB) {
      // Leave as pending — two real participants (possibly one was bye-advanced)
    } else if (nextMatch.participantA || nextMatch.participantB) {
      // One slot still empty — stays pending waiting for the sibling match
    }
  }
}

// ============================================================
// BracketService
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class BracketService {
  private readonly firestore = inject(Firestore);

  private bracketMatchesRef(tournamentId: string) {
    return collection(this.firestore, 'tournaments', tournamentId, 'bracketMatches');
  }

  private bracketDocRef(tournamentId: string) {
    return doc(this.firestore, 'tournaments', tournamentId, 'bracket', 'main');
  }

  /**
   * Checks whether all pool matches for a tournament are played.
   * Returns true only when every match across every pool has status === 'played'.
   */
  async allPoolMatchesPlayed(tournamentId: string): Promise<boolean> {
    const poolsRef = collection(this.firestore, 'tournaments', tournamentId, 'pools');
    const poolsSnap = await getDocs(poolsRef);

    for (const poolDoc of poolsSnap.docs) {
      const matchesRef = collection(
        this.firestore,
        'tournaments',
        tournamentId,
        'pools',
        poolDoc.id,
        'matches'
      );
      const matchesSnap = await getDocs(matchesRef);
      const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
      const allPlayed = matches.every((m) => m.status === 'played');
      if (!allPlayed) return false;
    }

    return true;
  }

  /**
   * Generates the bracket for a tournament:
   * 1. Verifies all pool matches are played.
   * 2. Loads pools and standings.
   * 3. Collects qualified participants, computes byes, seeds bracket.
   * 4. Writes bracket metadata + R1 matches to Firestore.
   *
   * NOTE: This generates a single bracket aggregating all game types.
   * For tournaments with multiple game types, each qualifies their participants
   * into the same bracket. A future enhancement could generate per-gameType brackets.
   */
  async generateBracket(tournamentId: string): Promise<void> {
    const allPlayed = await this.allPoolMatchesPlayed(tournamentId);
    if (!allPlayed) {
      throw new Error(
        'Impossible de générer le tableau : tous les matchs de poule doivent être joués.'
      );
    }

    // Load tournament to get poolConfig
    const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
    const tournamentSnap = await import('@angular/fire/firestore').then(({ getDoc }) =>
      getDoc(tournamentRef)
    );
    if (!tournamentSnap.exists()) {
      throw new Error(`Tournoi ${tournamentId} introuvable.`);
    }
    const tournamentData = tournamentSnap.data() as {
      poolConfig?: { gameType: string; poolCount: number; qualifiersPerPool: 0 | 1 | 2 }[];
    };
    const poolConfig = (tournamentData.poolConfig ?? []) as import('../models/tournament.model').PoolConfig[];

    // Load all pools
    const poolsRef = collection(this.firestore, 'tournaments', tournamentId, 'pools');
    const poolsSnap = await getDocs(poolsRef);
    const pools = poolsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pool));

    // Load standings for each pool
    const standingsByPool = new Map<string, PoolStanding[]>();
    for (const pool of pools) {
      const standingsRef = collection(
        this.firestore,
        'tournaments',
        tournamentId,
        'pools',
        pool.id,
        'standings'
      );
      const standingsSnap = await getDocs(standingsRef);
      const standings = standingsSnap.docs.map(
        (d) => ({ ...d.data(), participantId: d.id } as PoolStanding)
      );
      standingsByPool.set(pool.id, standings);
    }

    // Collect and rank qualifiers
    const qualifiers = collectQualifiers(pools, standingsByPool, poolConfig);

    if (qualifiers.length < 2) {
      throw new Error('Pas assez de qualifiés pour générer un tableau (minimum 2).');
    }

    const bracketSize = nextPowerOf2(qualifiers.length);
    const totalRounds = Math.log2(bracketSize);

    // Generate R1 matches with seeding + byes + anti-collision
    const r1Matches = seedBracket(qualifiers, bracketSize);

    // Generate empty subsequent round matches
    const laterMatches = generateSubsequentRounds(bracketSize);

    // Propagate byes: fill winners of bye matches into subsequent rounds
    const allMatches = [...r1Matches, ...laterMatches];
    propagateByes(allMatches);

    // Write to Firestore
    // 1. Delete existing bracket matches
    const bracketMatchesRef = this.bracketMatchesRef(tournamentId);
    const existingSnap = await getDocs(bracketMatchesRef);
    const batch = writeBatch(this.firestore);
    existingSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    // 2. Write new bracket matches
    const writeBatch2 = writeBatch(this.firestore);
    for (const match of allMatches) {
      const matchRef = doc(bracketMatchesRef, match.id);
      writeBatch2.set(matchRef, match);
    }
    // 3. Write bracket metadata
    const bracketDocRef = this.bracketDocRef(tournamentId);
    writeBatch2.set(bracketDocRef, {
      tournamentId,
      rounds: totalRounds,
      generatedAt: new Date().toISOString(),
      bracketSize,
      qualifierCount: qualifiers.length,
    });
    await writeBatch2.commit();
  }

  /**
   * Returns a real-time observable of all bracket matches for a tournament,
   * ordered by round then position.
   */
  getBracket(tournamentId: string): Observable<BracketMatch[]> {
    return collectionData(this.bracketMatchesRef(tournamentId), {
      idField: 'id',
    }) as Observable<BracketMatch[]>;
  }

  /**
   * Updates the score of a bracket match.
   * - Validates scores against badminton rules.
   * - Determines the winner.
   * - Writes match result to Firestore (scores field, same format as bracket.model).
   * - Propagates the winner to the next round match at position ceil(P/2),
   *   participant slot A if position is odd, B if even.
   * - If this is the final match (round === bracket.rounds), marks the tournament
   *   as completed and sets tournament.champion.
   *
   * @param tournamentId - Tournament ID
   * @param matchId - Bracket match document ID (e.g. 'r1-m3')
   * @param sets - Array of set scores (best of 3, badminton rules)
   * @param forfeit - Optional: ID of the forfeiting participant
   */
  async updateBracketMatchScore(
    tournamentId: string,
    matchId: string,
    sets: SetScore[],
    forfeit?: string
  ): Promise<void> {
    // Load the bracket match
    const matchRef = doc(this.bracketMatchesRef(tournamentId), matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) {
      throw new Error(`Match de bracket ${matchId} introuvable.`);
    }
    const match = { id: matchSnap.id, ...matchSnap.data() } as BracketMatch;

    if (!match.participantA || !match.participantB) {
      throw new Error('Ce match ne peut pas être joué : un ou les deux participants manquent.');
    }

    // Validate scores
    const validation = validateMatch(sets, forfeit);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Score invalide.');
    }

    // Determine winner
    const winnerId = determineMatchWinner(
      sets,
      match.participantA.id,
      match.participantB.id,
      forfeit
    );
    if (!winnerId) {
      throw new Error('Impossible de déterminer le gagnant.');
    }

    // Build update for this match
    const matchUpdate: Partial<BracketMatch> & Record<string, unknown> = {
      status: 'played',
      scores: forfeit ? [] : sets.map((s) => ({ a: s.a, b: s.b })),
      winnerId,
    };
    if (forfeit) {
      matchUpdate['forfeitParticipantId'] = forfeit;
    }

    // Load bracket metadata to know total rounds
    const bracketSnap = await getDoc(this.bracketDocRef(tournamentId));
    const bracketMeta = bracketSnap.exists()
      ? (bracketSnap.data() as { rounds: number; bracketSize: number })
      : null;
    const totalRounds = bracketMeta?.rounds ?? 0;

    // Determine winner participant info for propagation
    const winnerParticipant =
      match.participantA.id === winnerId ? match.participantA : match.participantB;

    // Propagate winner to next round (if not final)
    const isLastRound = totalRounds > 0 && match.round === totalRounds;

    const batch = writeBatch(this.firestore);

    // Update this match
    batch.update(matchRef, matchUpdate);

    if (!isLastRound) {
      const nextRound = match.round + 1;
      const nextPosition = Math.ceil(match.position / 2);
      const nextMatchRef = doc(
        this.bracketMatchesRef(tournamentId),
        `r${nextRound}-m${nextPosition}`
      );
      const nextMatchSnap = await getDoc(nextMatchRef);
      if (nextMatchSnap.exists()) {
        // Position odd → slot A, position even → slot B
        if (match.position % 2 === 1) {
          batch.update(nextMatchRef, { participantA: winnerParticipant });
        } else {
          batch.update(nextMatchRef, { participantB: winnerParticipant });
        }
      }
    }

    await batch.commit();

    // If final match played, mark tournament as completed + set champion
    if (isLastRound) {
      const tournamentRef = doc(this.firestore, 'tournaments', tournamentId);
      await updateDoc(tournamentRef, {
        status: 'Terminé',
        champion: winnerId,
      });
    }
  }
}
