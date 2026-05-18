import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  setDoc,
} from '@angular/fire/firestore';
import { firestoreStream } from '../utils/firestore-stream';
import { Observable } from 'rxjs';
import { Match } from '../models/match.model';
import { PoolStanding, PoolStandings } from '../models/standings.model';

/**
 * Pure function: computes pool standings from a list of matches.
 *
 * Scoring:
 *   - Victory      = 2 ranking points
 *   - Defeat       = 1 ranking point
 *   - Forfeit (forfeiting side) = 0 ranking points; opponent receives 2 (Victory)
 *
 * Matches with status !== 'played' are ignored.
 *
 * Tiebreaker order (when totalPoints are equal):
 *   1. Head-to-head mini-league among tied players only.
 *      Points are re-computed using only matches between the tied players.
 *      If the mini-league fully resolves the tie, the order stands.
 *      If the mini-league is still tied (all-equal or circular), fall through.
 *   2. Set difference (setsWon - setsLost) over all played matches.
 *   3. Point difference (pointsScored - pointsConceded) over all played matches.
 *   4. Alphabetical name (stable, deterministic fallback).
 *
 * @param matches    All matches for the pool (any status; non-played are skipped)
 * @param participants Array of {id, name} for all participants in the pool.
 *                     Required so participants with 0 played matches still appear.
 */
export function computeStandings(
  matches: Match[],
  participants: { id: string; name: string }[]
): PoolStandings {
  // Initialise a stats map keyed by participantId
  const statsMap = new Map<
    string,
    {
      name: string;
      matchesPlayed: number;
      victories: number;
      defeats: number;
      setsWon: number;
      setsLost: number;
      pointsScored: number;
      pointsConceded: number;
      totalPoints: number;
    }
  >();

  for (const p of participants) {
    statsMap.set(p.id, {
      name: p.name,
      matchesPlayed: 0,
      victories: 0,
      defeats: 0,
      setsWon: 0,
      setsLost: 0,
      pointsScored: 0,
      pointsConceded: 0,
      totalPoints: 0,
    });
  }

  const playedMatches = matches.filter((m) => m.status === 'played');

  for (const match of playedMatches) {
    const idA = match.participantA.id;
    const idB = match.participantB.id;
    const statsA = statsMap.get(idA);
    const statsB = statsMap.get(idB);

    // Skip if either participant is not in the pool (safety guard)
    if (!statsA || !statsB) continue;

    const forfeitId = match.forfeitParticipantId;
    const winnerId = match.winnerId;

    if (forfeitId) {
      // Forfeiting side: 0 pts, does NOT count as a match played
      // Winning side: 2 pts (Victory), counts as match played
      if (forfeitId === idA) {
        // A forfeited
        statsB.matchesPlayed += 1;
        statsB.victories += 1;
        statsB.totalPoints += 2;
        // A gets 0 pts and this match is NOT counted for A
      } else {
        // B forfeited
        statsA.matchesPlayed += 1;
        statsA.victories += 1;
        statsA.totalPoints += 2;
      }
    } else {
      // Normal match: both sides played
      statsA.matchesPlayed += 1;
      statsB.matchesPlayed += 1;

      // Set and point stats (only from sets array)
      if (match.sets && match.sets.length > 0) {
        for (const set of match.sets) {
          statsA.setsWon += set.a > set.b ? 1 : 0;
          statsA.setsLost += set.a < set.b ? 1 : 0;
          statsB.setsWon += set.b > set.a ? 1 : 0;
          statsB.setsLost += set.b < set.a ? 1 : 0;
          statsA.pointsScored += set.a;
          statsA.pointsConceded += set.b;
          statsB.pointsScored += set.b;
          statsB.pointsConceded += set.a;
        }
      }

      // Victory/defeat ranking points
      if (winnerId === idA) {
        statsA.victories += 1;
        statsA.totalPoints += 2;
        statsB.defeats += 1;
        statsB.totalPoints += 1;
      } else if (winnerId === idB) {
        statsB.victories += 1;
        statsB.totalPoints += 2;
        statsA.defeats += 1;
        statsA.totalPoints += 1;
      }
    }
  }

  // Build array from map
  const standings: Omit<PoolStanding, 'rank' | 'qualified'>[] = [];
  statsMap.forEach((stats, participantId) => {
    standings.push({ participantId, ...stats });
  });

  // Sort with tiebreakers
  standings.sort((a, b) => {
    // Primary: total points descending
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;

    // Tiebreaker 1: head-to-head mini-league among all players tied at this score
    // We identify the full tied group, recompute mini-league points, then compare
    const tiedGroup = standings.filter((s) => s.totalPoints === a.totalPoints);
    if (tiedGroup.length > 1) {
      const h2hA = computeHeadToHeadPoints(a.participantId, tiedGroup.map((s) => s.participantId), playedMatches);
      const h2hB = computeHeadToHeadPoints(b.participantId, tiedGroup.map((s) => s.participantId), playedMatches);
      if (h2hB !== h2hA) return h2hB - h2hA;
    }

    // Tiebreaker 2: set difference descending
    const setDiffA = a.setsWon - a.setsLost;
    const setDiffB = b.setsWon - b.setsLost;
    if (setDiffB !== setDiffA) return setDiffB - setDiffA;

    // Tiebreaker 3: point difference descending
    const ptDiffA = a.pointsScored - a.pointsConceded;
    const ptDiffB = b.pointsScored - b.pointsConceded;
    if (ptDiffB !== ptDiffA) return ptDiffB - ptDiffA;

    // Fallback: alphabetical name
    return a.name.localeCompare(b.name);
  });

  // Assign ranks and qualified (qualified defaults to false — set by consumer)
  return standings.map((s, index) => ({
    ...s,
    rank: index + 1,
    qualified: false,
  }));
}

/**
 * Computes the ranking points for a participant within the head-to-head
 * mini-league restricted to matches among the given tied group.
 */
function computeHeadToHeadPoints(
  participantId: string,
  tiedIds: string[],
  playedMatches: Match[]
): number {
  const tiedSet = new Set(tiedIds);
  let pts = 0;

  for (const match of playedMatches) {
    const idA = match.participantA.id;
    const idB = match.participantB.id;

    // Only consider matches between two members of the tied group
    if (!tiedSet.has(idA) || !tiedSet.has(idB)) continue;

    const forfeitId = match.forfeitParticipantId;
    const winnerId = match.winnerId;

    if (forfeitId) {
      if (forfeitId !== participantId && (idA === participantId || idB === participantId)) {
        pts += 2; // opponent forfeited → Victory
      }
      // forfeiter gets 0
    } else {
      if (idA === participantId || idB === participantId) {
        if (winnerId === participantId) pts += 2;
        else pts += 1;
      }
    }
  }

  return pts;
}

@Injectable({
  providedIn: 'root',
})
export class StandingsService {
  private readonly firestore = inject(Firestore);

  private standingsRef(tournamentId: string, poolId: string) {
    return collection(
      this.firestore,
      'tournaments',
      tournamentId,
      'pools',
      poolId,
      'standings'
    );
  }

  /**
   * Reads all played matches for the pool, computes standings in memory,
   * then writes one document per participant into the standings subcollection.
   *
   * Existing standings documents are overwritten (upsert by participantId).
   */
  async recalculateStandings(tournamentId: string, poolId: string): Promise<void> {
    // Load all matches for the pool
    const matchesRef = collection(
      this.firestore,
      'tournaments',
      tournamentId,
      'pools',
      poolId,
      'matches'
    );
    const matchesSnap = await getDocs(matchesRef);
    const matches = matchesSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Match)
    );

    // Derive participant list from match documents (covers all participants even if 0 played)
    const participantMap = new Map<string, string>();
    for (const match of matches) {
      participantMap.set(match.participantA.id, match.participantA.name);
      participantMap.set(match.participantB.id, match.participantB.name);
    }
    const participants = Array.from(participantMap.entries()).map(
      ([id, name]) => ({ id, name })
    );

    // Compute standings (pure function)
    const standings = computeStandings(matches, participants);

    // Persist: upsert each participant's standing by participantId
    const standingsRef = this.standingsRef(tournamentId, poolId);
    for (const standing of standings) {
      const docRef = doc(standingsRef, standing.participantId.replace(/\+/g, '_'));
      await setDoc(docRef, standing);
    }
  }

  /**
   * Returns a real-time observable of standings for a given pool,
   * ordered by rank ascending.
   */
  getPoolStandings(tournamentId: string, poolId: string): Observable<PoolStanding[]> {
    return firestoreStream(this.standingsRef(tournamentId, poolId), 'participantId') as Observable<PoolStanding[]>;
  }
}
