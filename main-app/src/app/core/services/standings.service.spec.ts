import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { computeStandings, StandingsService } from './standings.service';
import { Match } from '../models/match.model';

// ========================
// Helpers
// ========================

function makeMatch(
  id: string,
  idA: string,
  nameA: string,
  idB: string,
  nameB: string,
  setsA: number[],
  setsB: number[],
  winnerId: string
): Match {
  const sets = setsA.map((a, i) => ({ a, b: setsB[i] }));
  return {
    id,
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: idA, name: nameA },
    participantB: { id: idB, name: nameB },
    status: 'played',
    sets,
    winnerId,
  };
}

function makeForfeitMatch(
  id: string,
  idA: string,
  nameA: string,
  idB: string,
  nameB: string,
  forfeitParticipantId: string,
  winnerId: string
): Match {
  return {
    id,
    tournamentId: 't1',
    poolId: 'pool1',
    gameType: 'simple-homme',
    participantA: { id: idA, name: nameA },
    participantB: { id: idB, name: nameB },
    status: 'played',
    sets: [],
    forfeitParticipantId,
    winnerId,
  };
}

const participants = [
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' },
  { id: 'p3', name: 'Charlie' },
];

// ========================
// computeStandings — pure function tests
// ========================

describe('computeStandings', () => {
  // ── Scenario 1: 3 players, simple case ──────────────────────────────────
  describe('3 joueurs, scores simples → vérifier rang 1/2/3', () => {
    // p1 beats p2, p1 beats p3, p2 beats p3
    // p1: 2V = 4 pts  → rank 1
    // p2: 1V 1D = 3 pts → rank 2
    // p3: 2D = 2 pts  → rank 3
    const matches: Match[] = [
      makeMatch('m1', 'p1', 'Alice', 'p2', 'Bob', [21, 21], [15, 10], 'p1'),
      makeMatch('m2', 'p1', 'Alice', 'p3', 'Charlie', [21, 21], [10, 8], 'p1'),
      makeMatch('m3', 'p2', 'Bob', 'p3', 'Charlie', [21, 21], [12, 14], 'p2'),
    ];

    it('should rank p1 first (2 victories, 4 pts)', () => {
      const standings = computeStandings(matches, participants);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      expect(p1.rank).toBe(1);
      expect(p1.victories).toBe(2);
      expect(p1.defeats).toBe(0);
      expect(p1.totalPoints).toBe(4);
    });

    it('should rank p2 second (1V 1D, 3 pts)', () => {
      const standings = computeStandings(matches, participants);
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p2.rank).toBe(2);
      expect(p2.victories).toBe(1);
      expect(p2.defeats).toBe(1);
      expect(p2.totalPoints).toBe(3);
    });

    it('should rank p3 third (2 defeats, 2 pts)', () => {
      const standings = computeStandings(matches, participants);
      const p3 = standings.find((s) => s.participantId === 'p3')!;
      expect(p3.rank).toBe(3);
      expect(p3.victories).toBe(0);
      expect(p3.defeats).toBe(2);
      expect(p3.totalPoints).toBe(2);
    });

    it('should return 3 entries', () => {
      expect(computeStandings(matches, participants)).toHaveLength(3);
    });
  });

  // ── Scenario 2: equal points → head-to-head tiebreak ────────────────────
  describe('égalité de points → départage par confrontation directe', () => {
    // p1 beats p2, p2 beats p3, p3 beats p1 → circular 3-way tie at 3 pts each.
    // In the mini-league they all still have 2pts vs each other → fall through to set diff.
    // To test clean head-to-head resolution: 2-way tie where h2h differs.
    //
    // Setup: p1 vs p2: p2 wins; p1 vs p3: p1 wins; p2 vs p3: p2 wins.
    // p1: 1V 1D = 3 pts
    // p2: 2V     = 4 pts → rank 1
    // p3: 2D     = 2 pts → rank 3
    // Not a tie — let's build a proper 2-way tie:
    //
    // 4 players: p1, p2, p3, p4
    // p1 beats p4, p2 beats p1 (h2h), p3 beats p2
    // p1: 1V (beat p4) + 1D (lost to p2) = 3 pts
    // p2: 1V (beat p1) + 1D (lost to p3) = 3 pts → tie between p1 and p2 only
    // p3: 1V (beat p2) = 2 pts → not in tied group
    // p4: 1D (lost to p1) = 1 pt → not in tied group
    // h2h among {p1, p2}: p2 beat p1 → p2 rank higher
    const participants4 = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
      { id: 'p4', name: 'David' },
    ];

    const matches: Match[] = [
      makeMatch('m1', 'p1', 'Alice', 'p4', 'David', [21, 21], [10, 8], 'p1'),
      makeMatch('m2', 'p2', 'Bob', 'p1', 'Alice', [21, 21], [18, 17], 'p2'),
      makeMatch('m3', 'p3', 'Charlie', 'p2', 'Bob', [21, 21], [15, 12], 'p3'),
    ];

    it('p1 and p2 both have 3 totalPoints', () => {
      const standings = computeStandings(matches, participants4);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p1.totalPoints).toBe(3);
      expect(p2.totalPoints).toBe(3);
    });

    it('p2 ranks above p1 due to head-to-head victory', () => {
      const standings = computeStandings(matches, participants4);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p2.rank).toBeLessThan(p1.rank);
    });
  });

  // ── Scenario 3: égalité complète → set diff then point diff ─────────────
  describe('égalité complète → départage par diff sets puis diff points', () => {
    // p1 vs p2: p1 wins 2-1 (p1 wins sets 21-19, p2 wins 21-15, p1 wins 21-18)
    // p2 vs p3: p2 wins 2-0 (21-19, 21-17)
    // p3 vs p1: p3 wins 2-0 (21-10, 21-11)
    // Each player: 1V 1D = 3 pts → 3-way tie
    // h2h mini-league: each has 1V 1D = 3pts → still tied → fall through to set diff
    // p1 sets: won 2+0=2 lost 1+2=3 → diff = -1
    // p2 sets: won 1+2=3 lost 2+0=3 → diff = 0
    // p3 sets: won 2+0=2 lost 0+2=2 → diff = 0
    // p2 and p3 tied on set diff → point diff
    // p2 points: (21+21+15) scored = 57, conceded (19+18+19+17)=73 → diff = -16
    //   wait let me recalculate...
    //
    // m1 p1 vs p2: sets [(21,19),(15,21),(21,18)], winner p1
    //   p1 pts scored: 21+15+21=57, conceded: 19+21+18=58 → diff -1
    //   p2 pts scored: 19+21+18=58, conceded: 21+15+21=57 → diff +1
    //   p1 sets: won 2, lost 1
    //   p2 sets: won 1, lost 2
    //
    // m2 p2 vs p3: sets [(21,19),(21,17)], winner p2
    //   p2 pts scored+=42, conceded+=36 → total p2 scored=100, conceded=93, diff=+7
    //   p3 pts scored=36, conceded=42
    //   p2 sets: won+2=3, lost 2
    //   p3 sets: won 0, lost 2
    //
    // m3 p3 vs p1: sets [(21,10),(21,11)], winner p3
    //   p3 pts scored+=42, conceded+=21 → total p3 scored=78, conceded=63
    //   p1 pts scored+=21, conceded+=42 → total p1 scored=78, conceded=100
    //   p3 sets: won 2, lost 0 → total won=2, lost=2
    //   p1 sets: won 0, lost 2 → total won=2, lost=3

    // Summary:
    // p1: 3pts, sets 2-3 (diff -1), pts 78-100 (diff -22)
    // p2: 3pts, sets 3-2 (diff +1), pts 100-93 (diff +7)
    // p3: 3pts, sets 2-2 (diff 0),  pts 78-63 (diff +15)
    //
    // All 3pts (h2h all tied too) → set diff: p2(+1) > p3(0) > p1(-1)
    // rank: p2=1, p3=2, p1=3

    const participants3 = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
    ];

    const matches: Match[] = [
      makeMatch('m1', 'p1', 'Alice', 'p2', 'Bob', [21, 15, 21], [19, 21, 18], 'p1'),
      makeMatch('m2', 'p2', 'Bob', 'p3', 'Charlie', [21, 21], [19, 17], 'p2'),
      makeMatch('m3', 'p3', 'Charlie', 'p1', 'Alice', [21, 21], [10, 11], 'p3'),
    ];

    it('all 3 players have 3 totalPoints', () => {
      const standings = computeStandings(matches, participants3);
      standings.forEach((s) => expect(s.totalPoints).toBe(3));
    });

    it('p2 ranks 1st (best set diff +1)', () => {
      const standings = computeStandings(matches, participants3);
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p2.rank).toBe(1);
      expect(p2.setsWon - p2.setsLost).toBe(1);
    });

    it('p3 ranks 2nd (set diff 0 > p1 diff -1)', () => {
      const standings = computeStandings(matches, participants3);
      const p3 = standings.find((s) => s.participantId === 'p3')!;
      expect(p3.rank).toBe(2);
    });

    it('p1 ranks 3rd (worst set diff -1)', () => {
      const standings = computeStandings(matches, participants3);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      expect(p1.rank).toBe(3);
    });
  });

  // ── Scenario 4: point diff tiebreak after set diff tie ───────────────────
  describe('égalité sur diff sets → départage par diff points', () => {
    // p1 vs p2: p1 wins 2-0 (21-10, 21-10) — big margin
    // p2 vs p3: p2 wins 2-0 (21-10, 21-10)
    // p3 vs p1: p3 wins 2-0 (21-10, 21-10)
    // Each: 1V 1D = 3pts, sets +2-2 (diff 0 each)
    // h2h: all tied
    // set diff: all 0
    // point diff:
    //   p1: scored (21+21+10+10)=62, conceded (10+10+21+21)=62 → diff 0  wait...
    //
    // m1 p1 vs p2: [(21,10),(21,10)] winner p1
    //   p1: scored 42, conceded 20; p2: scored 20, conceded 42
    // m2 p2 vs p3: [(21,10),(21,10)] winner p2
    //   p2: scored 42, conceded 20; p3: scored 20, conceded 42
    // m3 p3 vs p1: [(21,10),(21,10)] winner p3
    //   p3: scored 42, conceded 20; p1: scored 20, conceded 42
    //
    // p1 total: scored 42+20=62, conceded 20+42=62, diff 0
    // p2 total: scored 20+42=62, conceded 42+20=62, diff 0
    // p3 total: scored 20+42=62, conceded 42+20=62, diff 0
    // → all tied → fall to alphabetical

    // Instead: make p2 win more convincingly to get better point diff
    // m1 p1 vs p2: [(21-10),(21-10)] winner p1 — p1 scored 42, conceded 20
    // m2 p2 vs p3: [(21-5),(21-5)] winner p2 — p2 scored 42, conceded 10; p3 scored 10 conceded 42
    // m3 p3 vs p1: [(21-10),(21-10)] winner p3 — p3 scored 42, conceded 20; p1 scored 20 conceded 42
    //
    // p1: scored 42+20=62, conceded 20+42=62, diff 0; sets 2-2
    // p2: scored 20+42=62, conceded 42+10=52, diff +10; sets 2-2 (wait)
    //   m1 p1 wins: p2 scored 20, conceded 42
    //   m2 p2 wins: p2 scored 42, conceded 10
    //   p2 total: scored 62, conceded 52, diff +10
    // p3: scored 10+42=52, conceded 42+20=62, diff -10; sets 2-2
    //
    // ranking: p2(diff+10) > p1(diff 0) > p3(diff -10)

    const participants3 = [
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
    ];

    const matches: Match[] = [
      makeMatch('m1', 'p1', 'Alice', 'p2', 'Bob', [21, 21], [10, 10], 'p1'),
      makeMatch('m2', 'p2', 'Bob', 'p3', 'Charlie', [21, 21], [5, 5], 'p2'),
      makeMatch('m3', 'p3', 'Charlie', 'p1', 'Alice', [21, 21], [10, 10], 'p3'),
    ];

    it('all 3 players have equal set diffs of 0', () => {
      const standings = computeStandings(matches, participants3);
      standings.forEach((s) => expect(s.setsWon - s.setsLost).toBe(0));
    });

    it('p2 ranks 1st (best point diff +10)', () => {
      const standings = computeStandings(matches, participants3);
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p2.rank).toBe(1);
      expect(p2.pointsScored - p2.pointsConceded).toBe(10);
    });

    it('p1 ranks 2nd (point diff 0)', () => {
      const standings = computeStandings(matches, participants3);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      expect(p1.rank).toBe(2);
      expect(p1.pointsScored - p1.pointsConceded).toBe(0);
    });

    it('p3 ranks 3rd (worst point diff -10)', () => {
      const standings = computeStandings(matches, participants3);
      const p3 = standings.find((s) => s.participantId === 'p3')!;
      expect(p3.rank).toBe(3);
      expect(p3.pointsScored - p3.pointsConceded).toBe(-10);
    });
  });

  // ── Scenario 5: forfait = 0 pt ──────────────────────────────────────────
  describe('forfait = 0 pt pour le forfaiteur, 2 pts pour l\'adversaire', () => {
    const matches: Match[] = [
      makeForfeitMatch('m1', 'p1', 'Alice', 'p2', 'Bob', 'p1', 'p2'),
      makeMatch('m2', 'p2', 'Bob', 'p3', 'Charlie', [21, 21], [15, 10], 'p2'),
      makeMatch('m3', 'p1', 'Alice', 'p3', 'Charlie', [21, 21], [18, 16], 'p1'),
    ];

    it('p1 gets 0 pts for the forfeit match (not counted as played)', () => {
      const standings = computeStandings(matches, participants);
      const p1 = standings.find((s) => s.participantId === 'p1')!;
      // p1 forfeited m1 → 0 pts, m3 → Victory = 2 pts → total = 2
      expect(p1.totalPoints).toBe(2);
      // Forfeit match is NOT counted in matchesPlayed for the forfeiter
      expect(p1.matchesPlayed).toBe(1);
    });

    it('p2 gets 2 pts (Victory) when p1 forfeits', () => {
      const standings = computeStandings(matches, participants);
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      // m1: p1 forfeited → p2 wins (2pts); m2: p2 beats p3 (2pts) → total 4
      expect(p2.totalPoints).toBe(4);
      expect(p2.victories).toBe(2);
    });

    it('p2 ranks 1st', () => {
      const standings = computeStandings(matches, participants);
      const p2 = standings.find((s) => s.participantId === 'p2')!;
      expect(p2.rank).toBe(1);
    });
  });

  // ── Scenario 6: pending matches are ignored ──────────────────────────────
  describe('matchs en attente ignorés', () => {
    it('pending matches do not affect standings', () => {
      const pending: Match = {
        id: 'm-pending',
        tournamentId: 't1',
        poolId: 'pool1',
        gameType: 'simple-homme',
        participantA: { id: 'p1', name: 'Alice' },
        participantB: { id: 'p2', name: 'Bob' },
        status: 'pending',
      };
      const standings = computeStandings([pending], participants);
      standings.forEach((s) => {
        expect(s.totalPoints).toBe(0);
        expect(s.matchesPlayed).toBe(0);
      });
    });
  });

  // ── Scenario 7: qualified defaults to false ──────────────────────────────
  it('qualified defaults to false', () => {
    const standings = computeStandings([], participants);
    standings.forEach((s) => expect(s.qualified).toBe(false));
  });
});

// ========================
// StandingsService (Firestore wrapper)
// ========================

vi.mock('@angular/fire/firestore', () => {
  return {
    Firestore: class MockFirestore {},
    collection: vi.fn().mockReturnValue({ path: 'standings' }),
    collectionData: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    doc: vi.fn().mockReturnValue({ path: 'standings/doc' }),
    setDoc: vi.fn().mockResolvedValue(undefined),
  };
});

describe('StandingsService', () => {
  let service: StandingsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        StandingsService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(StandingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getPoolStandings() should return an Observable', () => {
    const result = service.getPoolStandings('t1', 'pool1');
    expect(result).toBeDefined();
    expect(typeof result.subscribe).toBe('function');
  });

  it('recalculateStandings() should call getDocs and setDoc', async () => {
    const { getDocs, setDoc } = await import('@angular/fire/firestore');

    const matchDoc = {
      id: 'm1',
      data: () => ({
        tournamentId: 't1',
        poolId: 'pool1',
        gameType: 'simple-homme',
        participantA: { id: 'p1', name: 'Alice' },
        participantB: { id: 'p2', name: 'Bob' },
        status: 'played',
        sets: [{ a: 21, b: 15 }, { a: 21, b: 12 }],
        winnerId: 'p1',
      }),
    };

    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [matchDoc] } as any);

    await service.recalculateStandings('t1', 'pool1');

    expect(getDocs).toHaveBeenCalled();
    // 2 participants → 2 setDoc calls
    expect(setDoc).toHaveBeenCalledTimes(2);
  });

  it('recalculateStandings() with no matches writes nothing', async () => {
    const { getDocs, setDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

    await service.recalculateStandings('t1', 'pool1');

    expect(setDoc).not.toHaveBeenCalled();
  });
});
