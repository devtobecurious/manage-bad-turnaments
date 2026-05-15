import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatchService } from './match.service';
import { PoolService } from './pool.service';
import { PlayerService } from './player.service';
import { StandingsService } from './standings.service';
import {
  generateRoundRobinPairs,
  validateSet,
  determineSetWinner,
  validateMatch,
  determineMatchWinner,
} from '../models/match.model';

// ========================
// Pure function tests
// ========================

describe('generateRoundRobinPairs', () => {
  it('should return 0 matches for 0 participants', () => {
    expect(generateRoundRobinPairs([])).toHaveLength(0);
  });

  it('should return 0 matches for 1 participant', () => {
    expect(generateRoundRobinPairs(['p1'])).toHaveLength(0);
  });

  it('should return 1 match for 2 participants — N*(N-1)/2 = 2*1/2 = 1', () => {
    const pairs = generateRoundRobinPairs(['p1', 'p2']);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual(['p1', 'p2']);
  });

  it('should return 3 matches for 3 participants — N*(N-1)/2 = 3*2/2 = 3', () => {
    const pairs = generateRoundRobinPairs(['p1', 'p2', 'p3']);
    expect(pairs).toHaveLength(3);
    expect(pairs).toContainEqual(['p1', 'p2']);
    expect(pairs).toContainEqual(['p1', 'p3']);
    expect(pairs).toContainEqual(['p2', 'p3']);
  });

  it('should return 6 matches for 4 participants — N*(N-1)/2 = 4*3/2 = 6', () => {
    const pairs = generateRoundRobinPairs(['p1', 'p2', 'p3', 'p4']);
    expect(pairs).toHaveLength(6);
  });

  it('should return 10 matches for 5 participants — N*(N-1)/2 = 5*4/2 = 10', () => {
    const pairs = generateRoundRobinPairs(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(pairs).toHaveLength(10);
  });

  it('should not duplicate pairs', () => {
    const pairs = generateRoundRobinPairs(['p1', 'p2', 'p3', 'p4']);
    const seen = new Set(pairs.map(([a, b]) => `${a}:${b}`));
    expect(seen.size).toBe(pairs.length);
  });

  it('should always have participantA before participantB (consistent ordering)', () => {
    const participants = ['p1', 'p2', 'p3'];
    const pairs = generateRoundRobinPairs(participants);
    for (const [a, b] of pairs) {
      const idxA = participants.indexOf(a);
      const idxB = participants.indexOf(b);
      expect(idxA).toBeLessThan(idxB);
    }
  });
});

// ========================
// validateSet — pure function tests
// ========================

describe('validateSet', () => {
  // Valid cases
  it('validateSet(21, 19) → valide', () => {
    expect(validateSet(21, 19)).toBe(true);
  });

  it('validateSet(21, 0) → valide (normal win by 21 or more lead)', () => {
    expect(validateSet(21, 0)).toBe(true);
  });

  it('validateSet(22, 20) → valide (2 pts d\'écart)', () => {
    expect(validateSet(22, 20)).toBe(true);
  });

  it('validateSet(29, 27) → valide (2 pts d\'écart, below 30)', () => {
    expect(validateSet(29, 27)).toBe(true);
  });

  it('validateSet(30, 29) → valide (exception max score)', () => {
    expect(validateSet(30, 29)).toBe(true);
  });

  // Invalid cases
  it('validateSet(21, 20) → invalide (pas 2 pts d\'écart)', () => {
    expect(validateSet(21, 20)).toBe(false);
  });

  it('validateSet(30, 28) → invalide (30 n\'est atteint que par 30-29)', () => {
    expect(validateSet(30, 28)).toBe(false);
  });

  it('validateSet(20, 18) → invalide (score gagnant < 21)', () => {
    expect(validateSet(20, 18)).toBe(false);
  });

  it('validateSet(30, 30) → invalide (égalité)', () => {
    expect(validateSet(30, 30)).toBe(false);
  });

  it('validateSet(31, 29) → invalide (score > 30)', () => {
    expect(validateSet(31, 29)).toBe(false);
  });

  it('validateSet(-1, 21) → invalide (score négatif)', () => {
    expect(validateSet(-1, 21)).toBe(false);
  });
});

// ========================
// determineSetWinner — pure function tests
// ========================

describe('determineSetWinner', () => {
  it('returns A when A wins 21-19', () => {
    expect(determineSetWinner(21, 19)).toBe('A');
  });

  it('returns B when B wins 19-21', () => {
    expect(determineSetWinner(19, 21)).toBe('B');
  });

  it('returns null for invalid set 21-20', () => {
    expect(determineSetWinner(21, 20)).toBeNull();
  });
});

// ========================
// validateMatch — pure function tests
// ========================

describe('validateMatch', () => {
  it('valide : 2-0 (21-19, 21-15)', () => {
    const result = validateMatch([{ a: 21, b: 19 }, { a: 21, b: 15 }]);
    expect(result.valid).toBe(true);
  });

  it('valide : 2-1 (21-19, 18-21, 21-19)', () => {
    const result = validateMatch([{ a: 21, b: 19 }, { a: 18, b: 21 }, { a: 21, b: 19 }]);
    expect(result.valid).toBe(true);
  });

  it('valide : forfait', () => {
    const result = validateMatch([], 'pA');
    expect(result.valid).toBe(true);
  });

  it('invalide : match non terminé (1-1 sans 3e set)', () => {
    const result = validateMatch([{ a: 21, b: 19 }, { a: 18, b: 21 }]);
    expect(result.valid).toBe(false);
  });

  it('invalide : plus de 3 sets', () => {
    const result = validateMatch([
      { a: 21, b: 19 }, { a: 18, b: 21 }, { a: 21, b: 15 }, { a: 21, b: 15 }
    ]);
    expect(result.valid).toBe(false);
  });

  it('invalide : set invalide dans la liste', () => {
    const result = validateMatch([{ a: 21, b: 20 }]);
    expect(result.valid).toBe(false);
  });

  it('invalide : sets joués après fin du match', () => {
    // 2-0 + extra set = invalid
    const result = validateMatch([{ a: 21, b: 19 }, { a: 21, b: 15 }, { a: 21, b: 10 }]);
    expect(result.valid).toBe(false);
  });

  it('invalide : aucun set saisi', () => {
    const result = validateMatch([]);
    expect(result.valid).toBe(false);
  });
});

// ========================
// determineMatchWinner — pure function tests
// ========================

describe('determineMatchWinner', () => {
  const pA = 'playerA';
  const pB = 'playerB';

  it('A gagne 2-0', () => {
    expect(determineMatchWinner([{ a: 21, b: 19 }, { a: 21, b: 15 }], pA, pB)).toBe(pA);
  });

  it('B gagne 2-0', () => {
    expect(determineMatchWinner([{ a: 19, b: 21 }, { a: 15, b: 21 }], pA, pB)).toBe(pB);
  });

  it('A gagne 2-1', () => {
    expect(determineMatchWinner(
      [{ a: 21, b: 19 }, { a: 18, b: 21 }, { a: 21, b: 19 }], pA, pB
    )).toBe(pA);
  });

  it('forfait A → B gagne', () => {
    expect(determineMatchWinner([], pA, pB, pA)).toBe(pB);
  });

  it('forfait B → A gagne', () => {
    expect(determineMatchWinner([], pA, pB, pB)).toBe(pA);
  });

  it('retourne null si match invalide', () => {
    expect(determineMatchWinner([{ a: 21, b: 20 }], pA, pB)).toBeNull();
  });
});

// ========================
// MatchService tests
// ========================

vi.mock('@angular/fire/firestore', () => {
  const batchObj = {
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  (globalThis as any).__matchMockBatch = batchObj;

  return {
    Firestore: class MockFirestore {},
    collection: vi.fn().mockReturnValue({ path: 'matches' }),
    collectionData: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'match-id-1' }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    writeBatch: vi.fn().mockImplementation(() => batchObj),
    doc: vi.fn().mockReturnValue({ path: 'matches/match-1' }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock services provided via TestBed (no relative vi.mock)
const mockPoolService = {};
const mockPlayerService = {
  getPlayer: vi.fn().mockResolvedValue(null),
};
const mockStandingsService = {
  recalculateStandings: vi.fn().mockResolvedValue(undefined),
};

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const batchObj = (globalThis as any).__matchMockBatch;
    batchObj.delete.mockClear();
    batchObj.commit.mockResolvedValue(undefined);

    mockPlayerService.getPlayer.mockResolvedValue(null);
    mockStandingsService.recalculateStandings.mockResolvedValue(undefined);

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        MatchService,
        { provide: Firestore, useValue: {} },
        { provide: PoolService, useValue: mockPoolService },
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: StandingsService, useValue: mockStandingsService },
      ],
    });

    service = TestBed.inject(MatchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getMatchesForPool() should return an Observable', () => {
    const result = service.getMatchesForPool('t1', 'pool1');
    expect(result).toBeDefined();
    expect(typeof result.subscribe).toBe('function');
  });

  it('getMatchesForPool() should use correct Firestore collection path', async () => {
    const { collection } = await import('@angular/fire/firestore');
    service.getMatchesForPool('t1', 'pool1');
    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      'tournaments',
      't1',
      'pools',
      'pool1',
      'matches'
    );
  });

  describe('generateMatches()', () => {
    it('should throw if pool is not found', async () => {
      const { getDocs } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

      await expect(service.generateMatches('t1', 'missing-pool')).rejects.toThrow(
        'Pool missing-pool not found'
      );
    });

    it('should generate N*(N-1)/2 matches for a singles pool with 3 members', async () => {
      const { getDocs, addDoc } = await import('@angular/fire/firestore');

      // First getDocs: pool collection → returns pool doc with 3 members
      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'simple-homme',
                memberIds: ['p1', 'p2', 'p3'],
              }),
            },
          ],
        } as any)
        // Second getDocs: existing matches → empty
        .mockResolvedValueOnce({ docs: [] } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'match-id' } as any);

      await service.generateMatches('t1', 'pool1');

      // 3 participants → 3 matches
      expect(addDoc).toHaveBeenCalledTimes(3);
    });

    it('should generate N*(N-1)/2 matches for a singles pool with 4 members', async () => {
      const { getDocs, addDoc } = await import('@angular/fire/firestore');

      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'simple-homme',
                memberIds: ['p1', 'p2', 'p3', 'p4'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'match-id' } as any);

      await service.generateMatches('t1', 'pool1');

      // 4 participants → 6 matches
      expect(addDoc).toHaveBeenCalledTimes(6);
    });

    it('should generate N*(N-1)/2 matches for a doubles pool with 4 teams (8 memberIds)', async () => {
      const { getDocs, addDoc } = await import('@angular/fire/firestore');

      // 4 pairs = 8 memberIds → 4*(4-1)/2 = 6 matches
      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'double-homme',
                memberIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'match-id' } as any);

      await service.generateMatches('t1', 'pool1');

      // 4 teams → 6 matches
      expect(addDoc).toHaveBeenCalledTimes(6);
    });

    it('should delete existing matches before writing new ones', async () => {
      const { getDocs } = await import('@angular/fire/firestore');
      const batchObj = (globalThis as any).__matchMockBatch;

      const existingMatchDoc = { ref: { path: 'matches/old-match' } };

      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'simple-homme',
                memberIds: ['p1', 'p2'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [existingMatchDoc] } as any);

      await service.generateMatches('t1', 'pool1');

      expect(batchObj.delete).toHaveBeenCalledWith(existingMatchDoc.ref);
      expect(batchObj.commit).toHaveBeenCalled();
    });

    it('should write matches with status "pending"', async () => {
      const { getDocs, addDoc } = await import('@angular/fire/firestore');

      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'simple-homme',
                memberIds: ['p1', 'p2'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'match-id' } as any);

      await service.generateMatches('t1', 'pool1');

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('should write matches with participantA and participantB containing id and name', async () => {
      const { getDocs, addDoc } = await import('@angular/fire/firestore');

      mockPlayerService.getPlayer
        .mockResolvedValueOnce({ id: 'p1', firstName: 'Alice', lastName: 'Martin', gender: 'femme', createdAt: '', active: true })
        .mockResolvedValueOnce({ id: 'p2', firstName: 'Bob', lastName: 'Dupont', gender: 'homme', createdAt: '', active: true });

      vi.mocked(getDocs)
        .mockResolvedValueOnce({
          docs: [
            {
              id: 'pool1',
              data: () => ({
                tournamentId: 't1',
                gameType: 'simple-homme',
                memberIds: ['p1', 'p2'],
              }),
            },
          ],
        } as any)
        .mockResolvedValueOnce({ docs: [] } as any);

      vi.mocked(addDoc).mockResolvedValue({ id: 'match-id' } as any);

      await service.generateMatches('t1', 'pool1');

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          participantA: { id: 'p1', name: 'Martin Alice' },
          participantB: { id: 'p2', name: 'Dupont Bob' },
        })
      );
    });
  });

  describe('updateMatchScore()', () => {
    const tournamentId = 't1';
    const poolId = 'pool1';
    const matchId = 'match-1';

    const matchDoc = {
      id: matchId,
      data: () => ({
        tournamentId,
        poolId,
        gameType: 'simple-homme',
        participantA: { id: 'pA', name: 'Alice Martin' },
        participantB: { id: 'pB', name: 'Bob Dupont' },
        status: 'pending',
      }),
    };

    it('should throw if match is not found', async () => {
      const { getDocs } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);

      await expect(
        service.updateMatchScore(tournamentId, poolId, 'unknown-match', [{ a: 21, b: 19 }, { a: 21, b: 15 }])
      ).rejects.toThrow('Match unknown-match not found');
    });

    it('should throw if sets are invalid', async () => {
      const { getDocs } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [matchDoc] } as any);

      await expect(
        service.updateMatchScore(tournamentId, poolId, matchId, [{ a: 21, b: 20 }])
      ).rejects.toThrow();
    });

    it('should call updateDoc with status played, sets, and winnerId', async () => {
      const { getDocs, updateDoc } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [matchDoc] } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await service.updateMatchScore(tournamentId, poolId, matchId, [
        { a: 21, b: 19 },
        { a: 21, b: 15 },
      ]);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'played',
          winnerId: 'pA',
          sets: [{ a: 21, b: 19 }, { a: 21, b: 15 }],
        })
      );
    });

    it('should handle forfeit: B wins when A forfeits', async () => {
      const { getDocs, updateDoc } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [matchDoc] } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await service.updateMatchScore(tournamentId, poolId, matchId, [], 'pA');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'played',
          winnerId: 'pB',
          forfeitParticipantId: 'pA',
        })
      );
    });

    it('should handle correction: updating an already played match', async () => {
      const playedMatchDoc = {
        id: matchId,
        data: () => ({
          tournamentId,
          poolId,
          gameType: 'simple-homme',
          participantA: { id: 'pA', name: 'Alice Martin' },
          participantB: { id: 'pB', name: 'Bob Dupont' },
          status: 'played',
          sets: [{ a: 21, b: 19 }, { a: 21, b: 15 }],
          winnerId: 'pA',
        }),
      };

      const { getDocs, updateDoc } = await import('@angular/fire/firestore');
      vi.mocked(getDocs).mockResolvedValueOnce({ docs: [playedMatchDoc] } as any);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Correction: B actually won
      await service.updateMatchScore(tournamentId, poolId, matchId, [
        { a: 19, b: 21 },
        { a: 15, b: 21 },
      ]);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'played',
          winnerId: 'pB',
        })
      );
    });
  });
});
