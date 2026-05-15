import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import {
  BracketService,
  collectQualifiers,
  computeByes,
  nextPowerOf2,
  seedBracket,
  RankedQualifier,
} from './bracket.service';
import { PoolStanding } from '../models/standings.model';
import { Pool } from '../models/pool.model';
import { PoolConfig } from '../models/tournament.model';

// ========================
// Helpers
// ========================

function makePool(id: string, gameType = 'simple-homme'): Pool {
  return {
    id,
    tournamentId: 't1',
    gameType: gameType as any,
    poolNumber: 1,
    memberIds: [],
    locked: true,
  };
}

function makeStanding(
  participantId: string,
  name: string,
  rank: number,
  totalPoints = 4,
  setsWon = 2,
  setsLost = 0,
  pointsScored = 42,
  pointsConceded = 20
): PoolStanding {
  return {
    participantId,
    name,
    rank,
    matchesPlayed: 2,
    victories: rank === 1 ? 2 : 1,
    defeats: rank === 1 ? 0 : 1,
    setsWon,
    setsLost,
    pointsScored,
    pointsConceded,
    totalPoints,
    qualified: true,
  };
}

const defaultPoolConfig: PoolConfig[] = [
  { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
];

// ========================
// nextPowerOf2
// ========================

describe('nextPowerOf2', () => {
  it('returns 1 for n=1', () => expect(nextPowerOf2(1)).toBe(1));
  it('returns 2 for n=2', () => expect(nextPowerOf2(2)).toBe(2));
  it('returns 4 for n=3', () => expect(nextPowerOf2(3)).toBe(4));
  it('returns 4 for n=4', () => expect(nextPowerOf2(4)).toBe(4));
  it('returns 8 for n=5', () => expect(nextPowerOf2(5)).toBe(8));
  it('returns 8 for n=6', () => expect(nextPowerOf2(6)).toBe(8));
  it('returns 8 for n=8', () => expect(nextPowerOf2(8)).toBe(8));
  it('returns 16 for n=9', () => expect(nextPowerOf2(9)).toBe(16));
});

// ========================
// computeByes
// ========================

describe('computeByes', () => {
  it('4 qualifiers in bracket of 4 → 0 byes', () => {
    expect(computeByes(4, 4)).toBe(0);
  });

  it('6 qualifiers in bracket of 8 → 2 byes', () => {
    expect(computeByes(6, 8)).toBe(2);
  });

  it('3 qualifiers in bracket of 4 → 1 bye', () => {
    expect(computeByes(3, 4)).toBe(1);
  });

  it('5 qualifiers in bracket of 8 → 3 byes', () => {
    expect(computeByes(5, 8)).toBe(3);
  });
});

// ========================
// collectQualifiers
// ========================

describe('collectQualifiers', () => {
  it('collects 1 qualifier per pool when qualifiersPerPool=1', () => {
    const pools = [makePool('pool1'), makePool('pool2')];
    const standingsByPool = new Map<string, PoolStanding[]>([
      ['pool1', [makeStanding('p1', 'Alice', 1), makeStanding('p2', 'Bob', 2)]],
      ['pool2', [makeStanding('p3', 'Charlie', 1), makeStanding('p4', 'David', 2)]],
    ]);
    const config: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    ];

    const result = collectQualifiers(pools, standingsByPool, config);
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.id)).toContain('p1');
    expect(result.map((q) => q.id)).toContain('p3');
  });

  it('collects 2 qualifiers per pool when qualifiersPerPool=2', () => {
    const pools = [makePool('pool1'), makePool('pool2')];
    const standingsByPool = new Map<string, PoolStanding[]>([
      ['pool1', [makeStanding('p1', 'Alice', 1), makeStanding('p2', 'Bob', 2), makeStanding('p5', 'Eve', 3)]],
      ['pool2', [makeStanding('p3', 'Charlie', 1), makeStanding('p4', 'David', 2), makeStanding('p6', 'Frank', 3)]],
    ]);
    const config: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 2 },
    ];

    const result = collectQualifiers(pools, standingsByPool, config);
    expect(result).toHaveLength(4);
    expect(result.map((q) => q.id)).toContain('p1');
    expect(result.map((q) => q.id)).toContain('p2');
    expect(result.map((q) => q.id)).toContain('p3');
    expect(result.map((q) => q.id)).toContain('p4');
  });

  it('excludes game types with qualifiersPerPool=0', () => {
    const pools = [makePool('pool1')];
    const standingsByPool = new Map<string, PoolStanding[]>([
      ['pool1', [makeStanding('p1', 'Alice', 1)]],
    ]);
    const config: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 1, qualifiersPerPool: 0 },
    ];

    const result = collectQualifiers(pools, standingsByPool, config);
    expect(result).toHaveLength(0);
  });

  it('sorts qualifiers: pool rank 1 before rank 2, then by totalPoints desc', () => {
    const pools = [makePool('pool1'), makePool('pool2')];
    // pool1 rank1 = p1 (4pts), pool2 rank1 = p3 (6pts)
    // Both rank 1, but p3 has more points → p3 should be first globally
    const standingsByPool = new Map<string, PoolStanding[]>([
      ['pool1', [makeStanding('p1', 'Alice', 1, 4)]],
      ['pool2', [makeStanding('p3', 'Charlie', 1, 6)]],
    ]);
    const config: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
    ];

    const result = collectQualifiers(pools, standingsByPool, config);
    expect(result[0].id).toBe('p3');
    expect(result[1].id).toBe('p1');
  });
});

// ========================
// seedBracket — pure function
// ========================

describe('seedBracket', () => {
  // ── Test 1: 4 qualifiers (power of 2) → 0 byes, 2 R1 matches ──────────────
  describe('4 qualifiers (power of 2) → 0 byes, 2 R1 matches', () => {
    const qualifiers: RankedQualifier[] = [
      { id: 'p1', name: 'Alice', poolId: 'pool1', poolRank: 1, totalPoints: 6, setDiff: 4, pointDiff: 20 },
      { id: 'p2', name: 'Bob', poolId: 'pool2', poolRank: 1, totalPoints: 5, setDiff: 3, pointDiff: 15 },
      { id: 'p3', name: 'Charlie', poolId: 'pool3', poolRank: 1, totalPoints: 4, setDiff: 2, pointDiff: 10 },
      { id: 'p4', name: 'David', poolId: 'pool4', poolRank: 1, totalPoints: 3, setDiff: 1, pointDiff: 5 },
    ];

    it('produces exactly 2 R1 matches', () => {
      const matches = seedBracket(qualifiers, 4);
      expect(matches).toHaveLength(2);
    });

    it('all matches have status pending (no byes)', () => {
      const matches = seedBracket(qualifiers, 4);
      expect(matches.every((m) => m.status === 'pending')).toBe(true);
    });

    it('all 4 participants are present', () => {
      const matches = seedBracket(qualifiers, 4);
      const ids = matches.flatMap((m) => [m.participantA?.id, m.participantB?.id]).filter(Boolean);
      expect(ids).toContain('p1');
      expect(ids).toContain('p2');
      expect(ids).toContain('p3');
      expect(ids).toContain('p4');
    });
  });

  // ── Test 2: 6 qualifiers → bracket of 8, 2 byes ────────────────────────────
  describe('6 qualifiers → bracket of 8, 2 byes', () => {
    const qualifiers: RankedQualifier[] = [
      { id: 'p1', name: 'Alice', poolId: 'pool1', poolRank: 1, totalPoints: 6, setDiff: 4, pointDiff: 20 },
      { id: 'p2', name: 'Bob', poolId: 'pool2', poolRank: 1, totalPoints: 5, setDiff: 3, pointDiff: 15 },
      { id: 'p3', name: 'Charlie', poolId: 'pool3', poolRank: 1, totalPoints: 4, setDiff: 2, pointDiff: 10 },
      { id: 'p4', name: 'David', poolId: 'pool4', poolRank: 1, totalPoints: 3, setDiff: 1, pointDiff: 5 },
      { id: 'p5', name: 'Eve', poolId: 'pool5', poolRank: 1, totalPoints: 2, setDiff: 0, pointDiff: 0 },
      { id: 'p6', name: 'Frank', poolId: 'pool6', poolRank: 1, totalPoints: 1, setDiff: -1, pointDiff: -5 },
    ];

    it('produces 4 R1 matches for bracket of 8', () => {
      const matches = seedBracket(qualifiers, 8);
      expect(matches).toHaveLength(4);
    });

    it('exactly 2 bye matches', () => {
      const matches = seedBracket(qualifiers, 8);
      const byeMatches = matches.filter((m) => m.status === 'bye');
      expect(byeMatches).toHaveLength(2);
    });

    it('top 2 seeds (p1, p2) get byes', () => {
      const matches = seedBracket(qualifiers, 8);
      const byeMatches = matches.filter((m) => m.status === 'bye');
      const byeIds = byeMatches.map((m) => m.participantA?.id ?? m.participantB?.id);
      // The best-ranked qualifiers should have byes (p1=seed1, p2=seed2)
      expect(byeIds).toContain('p1');
      expect(byeIds).toContain('p2');
    });

    it('bye matches have a winner pre-assigned', () => {
      const matches = seedBracket(qualifiers, 8);
      const byeMatches = matches.filter((m) => m.status === 'bye');
      byeMatches.forEach((m) => {
        expect(m.winnerId).toBeDefined();
      });
    });
  });

  // ── Test 3: Anti-collision — no intra-pool match in R1 ─────────────────────
  describe('no intra-pool confrontation in R1', () => {
    it('does not pair two participants from the same pool in R1 when possible', () => {
      // 4 qualifiers: 2 from pool1, 2 from pool2
      // After collision resolution, no R1 match should have both from same pool
      const qualifiers: RankedQualifier[] = [
        { id: 'p1', name: 'Alice', poolId: 'pool1', poolRank: 1, totalPoints: 6, setDiff: 4, pointDiff: 20 },
        { id: 'p2', name: 'Bob', poolId: 'pool2', poolRank: 1, totalPoints: 5, setDiff: 3, pointDiff: 15 },
        { id: 'p3', name: 'Charlie', poolId: 'pool1', poolRank: 2, totalPoints: 4, setDiff: 2, pointDiff: 10 },
        { id: 'p4', name: 'David', poolId: 'pool2', poolRank: 2, totalPoints: 3, setDiff: 1, pointDiff: 5 },
      ];

      const matches = seedBracket(qualifiers, 4);

      for (const match of matches) {
        if (match.participantA && match.participantB) {
          expect(match.participantA.fromPool).not.toBe(match.participantB.fromPool);
        }
      }
    });
  });

  // ── Test 4: Global ranking for bye attribution ──────────────────────────────
  describe('global ranking for bye attribution', () => {
    it('byes go to globally best-ranked participants (seed 1 and 2)', () => {
      // 6 qualifiers: sorted by global ranking, byes should go to seed 1 and 2
      const qualifiers: RankedQualifier[] = [
        { id: 'seed1', name: 'Best', poolId: 'pool1', poolRank: 1, totalPoints: 10, setDiff: 8, pointDiff: 30 },
        { id: 'seed2', name: 'Second', poolId: 'pool2', poolRank: 1, totalPoints: 8, setDiff: 6, pointDiff: 20 },
        { id: 'seed3', name: 'Third', poolId: 'pool3', poolRank: 1, totalPoints: 6, setDiff: 4, pointDiff: 10 },
        { id: 'seed4', name: 'Fourth', poolId: 'pool4', poolRank: 1, totalPoints: 4, setDiff: 2, pointDiff: 5 },
        { id: 'seed5', name: 'Fifth', poolId: 'pool5', poolRank: 1, totalPoints: 2, setDiff: 0, pointDiff: 0 },
        { id: 'seed6', name: 'Sixth', poolId: 'pool6', poolRank: 1, totalPoints: 1, setDiff: -1, pointDiff: -5 },
      ];

      const matches = seedBracket(qualifiers, 8);
      const byeMatches = matches.filter((m) => m.status === 'bye');
      const byeParticipantIds = byeMatches.map((m) => m.winnerId);

      // The 2 best-ranked should have byes
      expect(byeParticipantIds).toContain('seed1');
      expect(byeParticipantIds).toContain('seed2');

      // The lower-ranked should NOT have byes
      expect(byeParticipantIds).not.toContain('seed5');
      expect(byeParticipantIds).not.toContain('seed6');
    });
  });
});

// ========================
// BracketService (Firestore wrapper)
// ========================

vi.mock('@angular/fire/firestore', () => {
  return {
    Firestore: class MockFirestore {},
    collection: vi.fn().mockReturnValue({ path: 'bracketMatches' }),
    collectionData: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    doc: vi.fn().mockReturnValue({ path: 'bracket/main' }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    writeBatch: vi.fn().mockReturnValue({
      delete: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
    getDoc: vi.fn(),
  };
});

describe('BracketService', () => {
  let service: BracketService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        BracketService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(BracketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getBracket() should return an Observable', () => {
    const result = service.getBracket('t1');
    expect(result).toBeDefined();
    expect(typeof result.subscribe).toBe('function');
  });

  it('allPoolMatchesPlayed() returns true when no pools exist', async () => {
    const { getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

    const result = await service.allPoolMatchesPlayed('t1');
    expect(result).toBe(true);
  });

  it('allPoolMatchesPlayed() returns false when a pool has pending matches', async () => {
    const { getDocs } = await import('@angular/fire/firestore');

    // First call: pools
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: 'pool1', data: () => ({}) }],
    } as any);

    // Second call: matches for pool1 (has a pending match)
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        {
          id: 'm1',
          data: () => ({
            status: 'pending',
            participantA: { id: 'p1' },
            participantB: { id: 'p2' },
          }),
        },
      ],
    } as any);

    const result = await service.allPoolMatchesPlayed('t1');
    expect(result).toBe(false);
  });

  it('generateBracket() throws when not all pool matches are played', async () => {
    const { getDocs } = await import('@angular/fire/firestore');

    // pools
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{ id: 'pool1', data: () => ({}) }],
    } as any);

    // matches with pending
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [
        {
          id: 'm1',
          data: () => ({ status: 'pending' }),
        },
      ],
    } as any);

    await expect(service.generateBracket('t1')).rejects.toThrow(
      'tous les matchs de poule doivent être joués'
    );
  });
});
