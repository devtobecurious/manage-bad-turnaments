import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Match } from '../models/match.model';
import { BracketMatch } from '../models/bracket.model';
import { Tournament } from '../models/tournament.model';
import { PoolStanding } from '../models/standings.model';
import { GameType } from '../models/registration.model';
import { GameTypeStats, PlayerStats, TournamentResult } from '../models/stats.model';

// ============================================================
// Pure helper functions (exported for testing)
// ============================================================

/**
 * Returns true if a participant ID (possibly composite "a+b") includes the given playerId.
 */
export function participantIncludesPlayer(participantId: string, playerId: string): boolean {
  if (participantId === playerId) return true;
  return participantId.split('+').includes(playerId);
}

/**
 * Returns the matches (pool or bracket) in which the given player participated.
 * Handles both singles (plain ID) and doubles (composite "a+b" ID).
 */
export function filterMatchesForPlayer(matches: Match[], playerId: string): Match[] {
  return matches.filter(
    (m) =>
      participantIncludesPlayer(m.participantA.id, playerId) ||
      participantIncludesPlayer(m.participantB.id, playerId)
  );
}

/**
 * Returns the bracket matches in which the given player participated.
 */
export function filterBracketMatchesForPlayer(
  matches: BracketMatch[],
  playerId: string
): BracketMatch[] {
  return matches.filter(
    (m) =>
      (m.participantA && participantIncludesPlayer(m.participantA.id, playerId)) ||
      (m.participantB && participantIncludesPlayer(m.participantB.id, playerId))
  );
}

/**
 * Determines whether the given player won a pool match.
 * - If the match is not 'played', returns null.
 * - For forfeits: if the player forfeited, they lost; otherwise they won.
 * - Otherwise, checks winnerId (which may be composite for doubles).
 */
export function didPlayerWinMatch(match: Match, playerId: string): boolean | null {
  if (match.status !== 'played') return null;

  const playerIsA = match.participantA && participantIncludesPlayer(match.participantA.id, playerId);
  const playerIsB = match.participantB && participantIncludesPlayer(match.participantB.id, playerId);

  if (!playerIsA && !playerIsB) return null;

  if (match.forfeitParticipantId) {
    // If the player's side forfeited, they lost
    const playerSideId = playerIsA ? match.participantA.id : match.participantB.id;
    return !participantIncludesPlayer(match.forfeitParticipantId, playerId) &&
      match.forfeitParticipantId !== playerSideId;
  }

  if (!match.winnerId) return null;
  // Winner is the composite or plain ID of the winning side
  const winnerIsA = match.participantA && participantIncludesPlayer(match.participantA.id, playerId)
    ? match.winnerId === match.participantA.id
    : false;
  const winnerIsB = match.participantB && participantIncludesPlayer(match.participantB.id, playerId)
    ? match.winnerId === match.participantB.id
    : false;

  return winnerIsA || winnerIsB;
}

/**
 * Determines whether the given player won a bracket match.
 */
export function didPlayerWinBracketMatch(match: BracketMatch, playerId: string): boolean | null {
  if (match.status !== 'played' || !match.winnerId) return null;

  const playerIsA = match.participantA && participantIncludesPlayer(match.participantA.id, playerId);
  const playerIsB = match.participantB && participantIncludesPlayer(match.participantB.id, playerId);

  if (!playerIsA && !playerIsB) return null;

  const playerSideId = playerIsA ? match.participantA!.id : match.participantB!.id;
  return match.winnerId === playerSideId;
}

/**
 * Computes global and per-game-type stats from a list of played pool matches.
 * Only considers matches with status === 'played'.
 */
export function computeMatchStats(
  matches: Match[],
  playerId: string
): { global: PlayerStats['global']; byGameType: GameTypeStats[] } {
  const playerMatches = filterMatchesForPlayer(matches, playerId).filter(
    (m) => m.status === 'played'
  );

  let totalPlayed = 0;
  let totalWins = 0;
  let totalLosses = 0;

  const gameTypeMap = new Map<
    GameType,
    { played: number; wins: number; losses: number }
  >();

  for (const match of playerMatches) {
    const won = didPlayerWinMatch(match, playerId);
    if (won === null) continue;

    totalPlayed++;
    if (won) totalWins++;
    else totalLosses++;

    const gt = match.gameType;
    const existing = gameTypeMap.get(gt) ?? { played: 0, wins: 0, losses: 0 };
    existing.played++;
    if (won) existing.wins++;
    else existing.losses++;
    gameTypeMap.set(gt, existing);
  }

  const computeWinRate = (wins: number, played: number): number => {
    if (played === 0) return 0;
    return Math.round((wins / played) * 1000) / 10;
  };

  const byGameType: GameTypeStats[] = Array.from(gameTypeMap.entries()).map(
    ([gameType, stats]) => ({
      gameType,
      played: stats.played,
      wins: stats.wins,
      losses: stats.losses,
      winRate: computeWinRate(stats.wins, stats.played),
    })
  );

  return {
    global: {
      played: totalPlayed,
      wins: totalWins,
      losses: totalLosses,
      winRate: computeWinRate(totalWins, totalPlayed),
    },
    byGameType,
  };
}

/**
 * Computes the final rank of a player in a bracket.
 *
 * Rank mapping:
 * - Champion (winner of the final, round === totalRounds): rank 1
 * - Finalist (loser of the final): rank 2
 * - Semifinalist (loser of round totalRounds - 1): rank 3
 * - Otherwise (eliminated in round R of totalRounds): rank = bracketSize / 2^R + 1
 *   where bracketSize = 2^totalRounds.
 *
 * Returns null if the player has no played bracket matches.
 */
export function computeBracketRank(
  bracketMatches: BracketMatch[],
  playerId: string,
  totalRounds: number
): number | null {
  const playerBracketMatches = filterBracketMatchesForPlayer(bracketMatches, playerId).filter(
    (m) => m.status === 'played'
  );

  if (playerBracketMatches.length === 0) return null;

  // Find the latest round this player played
  const maxRoundPlayed = Math.max(...playerBracketMatches.map((m) => m.round));
  const lastMatch = playerBracketMatches.find((m) => m.round === maxRoundPlayed);

  if (!lastMatch) return null;

  const won = didPlayerWinBracketMatch(lastMatch, playerId);

  if (lastMatch.round === totalRounds) {
    // Final match
    return won ? 1 : 2;
  }

  if (won) {
    // Player won this round — they might have more matches; use the latest played
    // Actually this scenario can't happen here since we pick the last played match
    // and they should have more played matches in later rounds. But as a fallback:
    const bracketSize = Math.pow(2, totalRounds);
    const rank = bracketSize / Math.pow(2, maxRoundPlayed) + 1;
    return Math.floor(rank);
  } else {
    // Eliminated in this round
    const bracketSize = Math.pow(2, totalRounds);
    const rank = bracketSize / Math.pow(2, maxRoundPlayed) + 1;
    return Math.floor(rank);
  }
}

/**
 * Computes the final rank of a player in a tournament's pool phase.
 * Uses the best (lowest) rank across all pools the player participated in.
 */
export function computePoolRank(
  standingsByPool: Map<string, PoolStanding[]>,
  playerId: string
): number | null {
  let bestRank: number | null = null;
  for (const standings of standingsByPool.values()) {
    for (const standing of standings) {
      if (participantIncludesPlayer(standing.participantId, playerId)) {
        if (bestRank === null || standing.rank < bestRank) {
          bestRank = standing.rank;
        }
      }
    }
  }
  return bestRank;
}

/**
 * Aggregates all player stats from pool matches, bracket matches, standings, and tournaments.
 * Pure function — no Firestore access.
 */
export function aggregatePlayerStats(
  playerId: string,
  allPoolMatches: Match[],
  bracketMatchesByTournament: Map<string, { matches: BracketMatch[]; totalRounds: number }>,
  standingsByTournamentPool: Map<string, Map<string, PoolStanding[]>>,
  tournaments: Tournament[]
): PlayerStats {
  // Compute match stats from pool matches only
  const { global, byGameType } = computeMatchStats(allPoolMatches, playerId);

  // Compute tournament results
  const tournamentResults: TournamentResult[] = [];

  for (const tournament of tournaments) {
    const bracketData = bracketMatchesByTournament.get(tournament.id);
    const standingsByPool = standingsByTournamentPool.get(tournament.id);

    // Check if player participated in this tournament
    const tournamentPoolMatches = allPoolMatches.filter(
      (m) => m.tournamentId === tournament.id
    );
    const playerPoolMatches = filterMatchesForPlayer(tournamentPoolMatches, playerId);
    const playerBracketMatches = bracketData
      ? filterBracketMatchesForPlayer(bracketData.matches, playerId)
      : [];

    if (playerPoolMatches.length === 0 && playerBracketMatches.length === 0) {
      continue;
    }

    // Determine final rank
    let finalRank: number | null = null;
    let phase: 'pool' | 'bracket' = 'pool';

    if (bracketData && bracketData.matches.length > 0) {
      const bracketRank = computeBracketRank(
        bracketData.matches,
        playerId,
        bracketData.totalRounds
      );
      if (bracketRank !== null) {
        finalRank = bracketRank;
        phase = 'bracket';
      }
    }

    if (finalRank === null && standingsByPool) {
      const poolRank = computePoolRank(standingsByPool, playerId);
      if (poolRank !== null) {
        finalRank = poolRank;
        phase = 'pool';
      }
    }

    if (finalRank !== null) {
      tournamentResults.push({
        tournamentId: tournament.id,
        name: tournament.name,
        date: tournament.date,
        finalRank,
        phase,
      });
    }
  }

  // Sort tournament results by date descending (most recent first)
  tournamentResults.sort((a, b) => b.date.localeCompare(a.date));

  return {
    playerId,
    global,
    byGameType,
    tournaments: tournamentResults,
  };
}

// ============================================================
// StatsService
// ============================================================

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private readonly firestore = inject(Firestore);

  /**
   * Returns a real-time observable of aggregated player statistics.
   * Aggregates pool matches, bracket matches, and standings from Firestore.
   */
  getPlayerStats(playerId: string): Observable<PlayerStats> {
    // Load all tournaments first
    const tournamentsRef = collection(this.firestore, 'tournaments');
    const tournaments$ = collectionData(tournamentsRef, { idField: 'id' }) as Observable<
      Tournament[]
    >;

    return tournaments$.pipe(
      switchMap((tournaments) => {
        if (tournaments.length === 0) {
          return of({
            playerId,
            global: { played: 0, wins: 0, losses: 0, winRate: 0 },
            byGameType: [],
            tournaments: [],
          } as PlayerStats);
        }

        // For each tournament: load pools, matches, standings, and bracket
        const tournamentData$ = tournaments.map((tournament) =>
          from(this.loadTournamentData(tournament.id)).pipe(
            map((data) => ({ tournamentId: tournament.id, ...data }))
          )
        );

        return forkJoin(tournamentData$).pipe(
          map((allTournamentData) => {
            const allPoolMatches: Match[] = [];
            const bracketMatchesByTournament = new Map<
              string,
              { matches: BracketMatch[]; totalRounds: number }
            >();
            const standingsByTournamentPool = new Map<string, Map<string, PoolStanding[]>>();

            for (const data of allTournamentData) {
              // Accumulate pool matches
              allPoolMatches.push(...data.poolMatches);

              // Bracket matches
              if (data.bracketMatches.length > 0) {
                const totalRounds = data.bracketTotalRounds;
                bracketMatchesByTournament.set(data.tournamentId, {
                  matches: data.bracketMatches,
                  totalRounds,
                });
              }

              // Standings by pool
              if (data.standingsByPool.size > 0) {
                standingsByTournamentPool.set(data.tournamentId, data.standingsByPool);
              }
            }

            return aggregatePlayerStats(
              playerId,
              allPoolMatches,
              bracketMatchesByTournament,
              standingsByTournamentPool,
              tournaments
            );
          })
        );
      })
    );
  }

  /**
   * Loads all relevant data for a single tournament.
   */
  private async loadTournamentData(tournamentId: string): Promise<{
    poolMatches: Match[];
    bracketMatches: BracketMatch[];
    bracketTotalRounds: number;
    standingsByPool: Map<string, PoolStanding[]>;
  }> {
    const poolMatches: Match[] = [];
    const standingsByPool = new Map<string, PoolStanding[]>();

    // Load pools
    const poolsRef = collection(this.firestore, 'tournaments', tournamentId, 'pools');
    const poolsSnap = await getDocs(poolsRef);

    for (const poolDoc of poolsSnap.docs) {
      const poolId = poolDoc.id;

      // Load pool matches
      const matchesRef = collection(
        this.firestore,
        'tournaments',
        tournamentId,
        'pools',
        poolId,
        'matches'
      );
      const matchesSnap = await getDocs(matchesRef);
      const matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
      poolMatches.push(...matches);

      // Load standings
      const standingsRef = collection(
        this.firestore,
        'tournaments',
        tournamentId,
        'pools',
        poolId,
        'standings'
      );
      const standingsSnap = await getDocs(standingsRef);
      const standings = standingsSnap.docs.map(
        (d) => ({ ...d.data(), participantId: d.id } as PoolStanding)
      );
      standingsByPool.set(poolId, standings);
    }

    // Load bracket matches
    const bracketMatchesRef = collection(
      this.firestore,
      'tournaments',
      tournamentId,
      'bracketMatches'
    );
    const bracketSnap = await getDocs(bracketMatchesRef);
    const bracketMatches = bracketSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as BracketMatch)
    );

    // Load bracket metadata (total rounds)
    let bracketTotalRounds = 0;
    if (bracketMatches.length > 0) {
      bracketTotalRounds = Math.max(...bracketMatches.map((m) => m.round));
    }

    return { poolMatches, bracketMatches, bracketTotalRounds, standingsByPool };
  }
}
