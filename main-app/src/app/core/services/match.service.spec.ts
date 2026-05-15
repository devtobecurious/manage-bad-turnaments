import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { MatchService } from './match.service';
import { PoolService } from './pool.service';
import { PlayerService } from './player.service';
import { generateRoundRobinPairs } from '../models/match.model';

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
  };
});

// Mock services provided via TestBed (no relative vi.mock)
const mockPoolService = {};
const mockPlayerService = {
  getPlayer: vi.fn().mockResolvedValue(null),
};

describe('MatchService', () => {
  let service: MatchService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const batchObj = (globalThis as any).__matchMockBatch;
    batchObj.delete.mockClear();
    batchObj.commit.mockResolvedValue(undefined);

    mockPlayerService.getPlayer.mockResolvedValue(null);

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        MatchService,
        { provide: Firestore, useValue: {} },
        { provide: PoolService, useValue: mockPoolService },
        { provide: PlayerService, useValue: mockPlayerService },
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
});
