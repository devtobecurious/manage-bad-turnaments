import { describe, it, expect } from 'vitest';
import { Match } from '../models/match.model';
import { BracketMatch } from '../models/bracket.model';
import { PoolStanding } from '../models/standings.model';
import { Tournament } from '../models/tournament.model';
import {
  participantIncludesPlayer,
  filterMatchesForPlayer,
  computeMatchStats,
  computeBracketRank,
  computePoolRank,
  aggregatePlayerStats,
  didPlayerWinMatch,
} from './stats.service';

// ========================
// Helpers
// ========================

function makeMatch(
  id: string,
  tournamentId: string,
  poolId: string,
  idA: string,
  nameA: string,
  idB: string,
  nameB: string,
  winnerId: string,
  gameType: Match['gameType'] = 'simple-homme'
): Match {
  return {
    id,
    tournamentId,
    poolId,
    gameType,
    participantA: { id: idA, name: nameA },
    participantB: { id: idB, name: nameB },
    status: 'played',
    sets: [{ a: 21, b: 15 }, { a: 21, b: 17 }],
    winnerId,
  };
}

function makePendingMatch(
  id: string,
  tournamentId: string,
  poolId: string,
  idA: string,
  idB: string
): Match {
  return {
    id,
    tournamentId,
    poolId,
    gameType: 'simple-homme',
    participantA: { id: idA, name: idA },
    participantB: { id: idB, name: idB },
    status: 'pending',
  };
}

function makeBracketMatch(
  id: string,
  round: number,
  position: number,
  idA: string | null,
  idB: string | null,
  winnerId?: string,
  status: BracketMatch['status'] = 'played'
): BracketMatch {
  return {
    id,
    round,
    position,
    participantA: idA ? { id: idA, name: idA, fromPool: 'pool1' } : null,
    participantB: idB ? { id: idB, name: idB, fromPool: 'pool1' } : null,
    status,
    winnerId,
  };
}

function makeTournament(id: string, name: string, date: string): Tournament {
  return {
    id,
    name,
    date,
    status: 'Terminé',
    participationToken: null,
    createdAt: date,
  };
}

// ========================
// participantIncludesPlayer
// ========================

describe('participantIncludesPlayer', () => {
  it('returns true for exact match', () => {
    expect(participantIncludesPlayer('p1', 'p1')).toBe(true);
  });

  it('returns false when IDs differ', () => {
    expect(participantIncludesPlayer('p1', 'p2')).toBe(false);
  });

  it('returns true for composite ID containing the player', () => {
    expect(participantIncludesPlayer('p1+p2', 'p1')).toBe(true);
    expect(participantIncludesPlayer('p1+p2', 'p2')).toBe(true);
  });

  it('returns false for composite ID not containing the player', () => {
    expect(participantIncludesPlayer('p1+p2', 'p3')).toBe(false);
  });
});

// ========================
// filterMatchesForPlayer
// ========================

describe('filterMatchesForPlayer', () => {
  const m1 = makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1');
  const m2 = makeMatch('m2', 't1', 'pool1', 'p2', 'Bob', 'p3', 'Charlie', 'p2');
  const m3 = makeMatch('m3', 't1', 'pool1', 'p1+p4', 'Alice/Dan', 'p2+p3', 'Bob/Charlie', 'p1+p4', 'double-homme');

  it('finds matches where player is participantA', () => {
    const result = filterMatchesForPlayer([m1, m2], 'p1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('finds matches where player is participantB', () => {
    const result = filterMatchesForPlayer([m1, m2], 'p2');
    expect(result).toHaveLength(2);
  });

  it('finds matches where player is part of doubles composite ID', () => {
    const result = filterMatchesForPlayer([m1, m2, m3], 'p1');
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toContain('m3');
  });
});

// ========================
// computeMatchStats — global stats
// ========================

describe('computeMatchStats — global stats', () => {
  it('computes 3 matches played, 2 wins → winRate 66.7%', () => {
    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      makeMatch('m2', 't1', 'pool1', 'p1', 'Alice', 'p3', 'Charlie', 'p1'),
      makeMatch('m3', 't1', 'pool1', 'p2', 'Bob', 'p1', 'Alice', 'p2'),
    ];

    const { global } = computeMatchStats(matches, 'p1');

    expect(global.played).toBe(3);
    expect(global.wins).toBe(2);
    expect(global.losses).toBe(1);
    expect(global.winRate).toBe(66.7);
  });

  it('returns 0 winRate when no matches played', () => {
    const { global } = computeMatchStats([], 'p1');
    expect(global.played).toBe(0);
    expect(global.winRate).toBe(0);
  });

  it('returns 100% winRate for all wins', () => {
    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      makeMatch('m2', 't1', 'pool1', 'p1', 'Alice', 'p3', 'Charlie', 'p1'),
    ];
    const { global } = computeMatchStats(matches, 'p1');
    expect(global.winRate).toBe(100);
  });

  it('ignores pending matches', () => {
    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      makePendingMatch('m2', 't1', 'pool1', 'p1', 'p3'),
    ];
    const { global } = computeMatchStats(matches, 'p1');
    expect(global.played).toBe(1);
  });
});

// ========================
// computeMatchStats — by game type
// ========================

describe('computeMatchStats — by game type', () => {
  it('correctly ventilates stats by game type', () => {
    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1', 'simple-homme'),
      makeMatch('m2', 't1', 'pool1', 'p1', 'Alice', 'p3', 'Charlie', 'p3', 'simple-homme'),
      makeMatch('m3', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1', 'double-homme'),
    ];

    const { byGameType } = computeMatchStats(matches, 'p1');

    const simpleHomme = byGameType.find((g) => g.gameType === 'simple-homme');
    const doubleHomme = byGameType.find((g) => g.gameType === 'double-homme');

    expect(simpleHomme).toBeDefined();
    expect(simpleHomme!.played).toBe(2);
    expect(simpleHomme!.wins).toBe(1);
    expect(simpleHomme!.losses).toBe(1);
    expect(simpleHomme!.winRate).toBe(50);

    expect(doubleHomme).toBeDefined();
    expect(doubleHomme!.played).toBe(1);
    expect(doubleHomme!.wins).toBe(1);
    expect(doubleHomme!.losses).toBe(0);
    expect(doubleHomme!.winRate).toBe(100);
  });

  it('handles doubles composite IDs for game type ventilation', () => {
    const matches: Match[] = [
      {
        id: 'm1',
        tournamentId: 't1',
        poolId: 'pool1',
        gameType: 'double-homme',
        participantA: { id: 'p1+p4', name: 'Alice/Dan' },
        participantB: { id: 'p2+p3', name: 'Bob/Charlie' },
        status: 'played',
        sets: [{ a: 21, b: 15 }],
        winnerId: 'p1+p4',
      },
    ];

    const { byGameType, global } = computeMatchStats(matches, 'p1');
    expect(global.played).toBe(1);
    expect(global.wins).toBe(1);
    const dh = byGameType.find((g) => g.gameType === 'double-homme');
    expect(dh).toBeDefined();
    expect(dh!.wins).toBe(1);
  });
});

// ========================
// computeBracketRank
// ========================

describe('computeBracketRank', () => {
  it('returns 1 for tournament champion', () => {
    // totalRounds = 2 (4-player bracket: R1, R2=final)
    const bracketMatches: BracketMatch[] = [
      makeBracketMatch('r1-m1', 1, 1, 'p1', 'p2', 'p1'),
      makeBracketMatch('r2-m1', 2, 1, 'p1', 'p3', 'p1'), // final, p1 wins
    ];
    expect(computeBracketRank(bracketMatches, 'p1', 2)).toBe(1);
  });

  it('returns 2 for finalist (lost the final)', () => {
    const bracketMatches: BracketMatch[] = [
      makeBracketMatch('r1-m2', 1, 2, 'p3', 'p2', 'p2'),
      makeBracketMatch('r2-m1', 2, 1, 'p1', 'p2', 'p1'), // final, p2 loses
    ];
    expect(computeBracketRank(bracketMatches, 'p2', 2)).toBe(2);
  });

  it('returns 3 for semifinalist (lost R1 of a 2-round bracket)', () => {
    // totalRounds = 2, bracketSize = 4
    // Eliminated in R1 → rank = 4/2^1 + 1 = 3
    const bracketMatches: BracketMatch[] = [
      makeBracketMatch('r1-m1', 1, 1, 'p1', 'p4', 'p1'),
    ];
    expect(computeBracketRank(bracketMatches, 'p4', 2)).toBe(3);
  });

  it('returns null when player has no bracket matches', () => {
    expect(computeBracketRank([], 'p99', 2)).toBeNull();
  });
});

// ========================
// computePoolRank
// ========================

describe('computePoolRank', () => {
  it('returns the player pool rank', () => {
    const standings: PoolStanding[] = [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 3,
        victories: 3,
        defeats: 0,
        setsWon: 6,
        setsLost: 1,
        pointsScored: 300,
        pointsConceded: 150,
        totalPoints: 6,
        qualified: true,
      },
      {
        participantId: 'p2',
        name: 'Bob',
        rank: 2,
        matchesPlayed: 3,
        victories: 1,
        defeats: 2,
        setsWon: 2,
        setsLost: 4,
        pointsScored: 200,
        pointsConceded: 260,
        totalPoints: 3,
        qualified: false,
      },
    ];

    const standingsByPool = new Map<string, PoolStanding[]>([['pool1', standings]]);
    expect(computePoolRank(standingsByPool, 'p1')).toBe(1);
    expect(computePoolRank(standingsByPool, 'p2')).toBe(2);
    expect(computePoolRank(standingsByPool, 'p99')).toBeNull();
  });

  it('returns best rank when player appears in multiple pools (doubles)', () => {
    const standings1: PoolStanding[] = [
      {
        participantId: 'p1+p2',
        name: 'Pair AB',
        rank: 2,
        matchesPlayed: 2,
        victories: 1,
        defeats: 1,
        setsWon: 2,
        setsLost: 2,
        pointsScored: 80,
        pointsConceded: 80,
        totalPoints: 3,
        qualified: false,
      },
    ];
    const standings2: PoolStanding[] = [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 3,
        victories: 3,
        defeats: 0,
        setsWon: 6,
        setsLost: 0,
        pointsScored: 300,
        pointsConceded: 100,
        totalPoints: 6,
        qualified: true,
      },
    ];
    const standingsByPool = new Map<string, PoolStanding[]>([
      ['pool1', standings1],
      ['pool2', standings2],
    ]);
    // p1 appears in pool1 via composite and in pool2 directly
    expect(computePoolRank(standingsByPool, 'p1')).toBe(1);
  });
});

// ========================
// aggregatePlayerStats — tournament history
// ========================

describe('aggregatePlayerStats — tournament history', () => {
  it('includes tournament with pool rank when no bracket', () => {
    const playerId = 'p1';
    const tournament = makeTournament('t1', 'Open Club', '2026-03-01');

    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      makeMatch('m2', 't1', 'pool1', 'p1', 'Alice', 'p3', 'Charlie', 'p1'),
    ];

    const standings: PoolStanding[] = [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 2,
        victories: 2,
        defeats: 0,
        setsWon: 4,
        setsLost: 0,
        pointsScored: 84,
        pointsConceded: 32,
        totalPoints: 4,
        qualified: true,
      },
    ];

    const bracketMatchesByTournament = new Map();
    const standingsByTournamentPool = new Map([
      ['t1', new Map([['pool1', standings]])],
    ]);

    const stats = aggregatePlayerStats(
      playerId,
      matches,
      bracketMatchesByTournament,
      standingsByTournamentPool,
      [tournament]
    );

    expect(stats.tournaments).toHaveLength(1);
    expect(stats.tournaments[0].tournamentId).toBe('t1');
    expect(stats.tournaments[0].finalRank).toBe(1);
    expect(stats.tournaments[0].phase).toBe('pool');
    expect(stats.tournaments[0].name).toBe('Open Club');
  });

  it('includes tournament with bracket rank when player reached bracket', () => {
    const playerId = 'p1';
    const tournament = makeTournament('t1', 'Grand Slam', '2026-04-15');

    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
    ];

    // Player won the tournament (2-round bracket = 4-player bracket)
    const bracketMatches: BracketMatch[] = [
      makeBracketMatch('r1-m1', 1, 1, 'p1', 'p3', 'p1'),
      makeBracketMatch('r2-m1', 2, 1, 'p1', 'p4', 'p1'), // p1 wins the final
    ];

    const standings: PoolStanding[] = [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 1,
        victories: 1,
        defeats: 0,
        setsWon: 2,
        setsLost: 0,
        pointsScored: 42,
        pointsConceded: 15,
        totalPoints: 2,
        qualified: true,
      },
    ];

    const bracketMatchesByTournament = new Map([
      ['t1', { matches: bracketMatches, totalRounds: 2 }],
    ]);
    const standingsByTournamentPool = new Map([
      ['t1', new Map([['pool1', standings]])],
    ]);

    const stats = aggregatePlayerStats(
      playerId,
      matches,
      bracketMatchesByTournament,
      standingsByTournamentPool,
      [tournament]
    );

    expect(stats.tournaments).toHaveLength(1);
    expect(stats.tournaments[0].finalRank).toBe(1);
    expect(stats.tournaments[0].phase).toBe('bracket');
  });

  it('excludes tournaments where player did not participate', () => {
    const playerId = 'p1';
    const tournament1 = makeTournament('t1', 'Open A', '2026-01-10');
    const tournament2 = makeTournament('t2', 'Open B', '2026-02-10');

    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      // p1 not in t2
      makeMatch('m2', 't2', 'pool1', 'p2', 'Bob', 'p3', 'Charlie', 'p2'),
    ];

    const standings1: PoolStanding[] = [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 1,
        victories: 1,
        defeats: 0,
        setsWon: 2,
        setsLost: 0,
        pointsScored: 42,
        pointsConceded: 15,
        totalPoints: 2,
        qualified: false,
      },
    ];

    const standingsByTournamentPool = new Map([
      ['t1', new Map([['pool1', standings1]])],
      ['t2', new Map()],
    ]);

    const stats = aggregatePlayerStats(
      playerId,
      matches,
      new Map(),
      standingsByTournamentPool,
      [tournament1, tournament2]
    );

    expect(stats.tournaments).toHaveLength(1);
    expect(stats.tournaments[0].tournamentId).toBe('t1');
  });

  it('sorts tournament results by date descending', () => {
    const playerId = 'p1';
    const t1 = makeTournament('t1', 'Old', '2025-01-01');
    const t2 = makeTournament('t2', 'Recent', '2026-01-01');

    const matches: Match[] = [
      makeMatch('m1', 't1', 'pool1', 'p1', 'Alice', 'p2', 'Bob', 'p1'),
      makeMatch('m2', 't2', 'pool1', 'p1', 'Alice', 'p3', 'Charlie', 'p1'),
    ];

    const standings = (id: string): PoolStanding[] => [
      {
        participantId: 'p1',
        name: 'Alice',
        rank: 1,
        matchesPlayed: 1,
        victories: 1,
        defeats: 0,
        setsWon: 2,
        setsLost: 0,
        pointsScored: 42,
        pointsConceded: 15,
        totalPoints: 2,
        qualified: false,
      },
    ];

    const standingsByTournamentPool = new Map([
      ['t1', new Map([['pool1', standings('t1')]])],
      ['t2', new Map([['pool1', standings('t2')]])],
    ]);

    const stats = aggregatePlayerStats(
      playerId,
      matches,
      new Map(),
      standingsByTournamentPool,
      [t1, t2]
    );

    expect(stats.tournaments[0].tournamentId).toBe('t2');
    expect(stats.tournaments[1].tournamentId).toBe('t1');
  });
});

// ========================
// didPlayerWinMatch — forfeit
// ========================

describe('didPlayerWinMatch — forfeit', () => {
  it('returns false if player forfeited', () => {
    const match: Match = {
      id: 'm1',
      tournamentId: 't1',
      poolId: 'pool1',
      gameType: 'simple-homme',
      participantA: { id: 'p1', name: 'Alice' },
      participantB: { id: 'p2', name: 'Bob' },
      status: 'played',
      sets: [],
      forfeitParticipantId: 'p1',
      winnerId: 'p2',
    };
    expect(didPlayerWinMatch(match, 'p1')).toBe(false);
  });

  it('returns true if opponent forfeited', () => {
    const match: Match = {
      id: 'm1',
      tournamentId: 't1',
      poolId: 'pool1',
      gameType: 'simple-homme',
      participantA: { id: 'p1', name: 'Alice' },
      participantB: { id: 'p2', name: 'Bob' },
      status: 'played',
      sets: [],
      forfeitParticipantId: 'p2',
      winnerId: 'p1',
    };
    expect(didPlayerWinMatch(match, 'p1')).toBe(true);
  });
});
