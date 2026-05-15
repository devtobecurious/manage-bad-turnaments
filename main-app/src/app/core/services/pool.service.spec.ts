import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PoolService, fisherYatesShuffle, distributeIntoPools } from './pool.service';

// --- Mock @angular/fire/firestore ---

// The batch mock is created inside the vi.mock factory (hoisted by Vitest) and exposed via globalThis
// so that tests can access and assert on it after clearAllMocks resets.
vi.mock('@angular/fire/firestore', () => {
  const batchObj = {
    delete: vi.fn(),
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };
  // Expose on a global so we can reset it in beforeEach
  (globalThis as any).__mockBatch = batchObj;

  return {
    Firestore: class MockFirestore {},
    collection: vi.fn().mockReturnValue({ path: 'pools' }),
    collectionData: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'pool-id-1' }),
    doc: vi.fn().mockReturnValue({ path: 'tournaments/t1' }),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        poolConfig: [
          { gameType: 'simple-homme', poolCount: 2 },
          { gameType: 'simple-femme', poolCount: 2 },
        ],
        status: 'Inscriptions clôturées',
      }),
    }),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn().mockResolvedValue({ docs: [], empty: true }),
    query: vi.fn().mockImplementation((ref: any) => ref),
    where: vi.fn().mockReturnValue({}),
    writeBatch: vi.fn().mockImplementation(() => batchObj),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
  };
});

// ========================
// Pure functions tests
// ========================

describe('fisherYatesShuffle', () => {
  it('should return an array of the same length', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const result = fisherYatesShuffle(arr);
    expect(result).toHaveLength(arr.length);
  });

  it('should contain all original elements', () => {
    const arr = ['p1', 'p2', 'p3', 'p4'];
    const result = fisherYatesShuffle(arr);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('should not mutate the original array', () => {
    const arr = ['a', 'b', 'c'];
    const original = [...arr];
    fisherYatesShuffle(arr);
    expect(arr).toEqual(original);
  });

  it('should use the custom RNG — AC: relancer le tirage donne un ordre différent (déterministe)', () => {
    const arr = ['p1', 'p2', 'p3', 'p4', 'p5'];
    // Always returns 0 → always swaps with index 0 → predictable ordering
    const deterministicRng = vi.fn().mockReturnValue(0);
    const result = fisherYatesShuffle(arr, deterministicRng);
    expect(deterministicRng).toHaveBeenCalled();
    // With rng=0, every element ends up at index 0 iteratively → specific result
    expect(result).toHaveLength(5);
  });

  it('should produce different orderings with different RNGs', () => {
    const arr = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    let call = 0;
    const rng1 = () => (call++ % 2 === 0 ? 0 : 1); // pattern A
    call = 0;
    const rng2 = () => (call++ % 2 === 0 ? 0.9 : 0.1); // pattern B
    const result1 = fisherYatesShuffle(arr, rng1);
    const result2 = fisherYatesShuffle(arr, rng2);
    // At least one position differs
    const anyDifferent = result1.some((v, i) => v !== result2[i]);
    expect(anyDifferent).toBe(true);
  });
});

describe('distributeIntoPools', () => {
  it('should create the correct number of pools', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const result = distributeIntoPools(players, 2, 'simple-homme');
    expect(result).toHaveLength(2);
  });

  it('should distribute all participants', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const result = distributeIntoPools(players, 2, 'simple-homme');
    const allMembers = result.flat();
    expect(allMembers.sort()).toEqual([...players].sort());
  });

  it('should distribute equitably — no pool has more than ceil(n/k) members', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const result = distributeIntoPools(players, 2, 'simple-homme');
    const sizes = result.map((p) => p.length);
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    expect(maxSize - minSize).toBeLessThanOrEqual(1);
  });

  it('should throw if participants exceed capacity — AC: max 5 simples/poule', () => {
    const players = Array.from({ length: 11 }, (_, i) => `p${i + 1}`);
    expect(() => distributeIntoPools(players, 2, 'simple-homme')).toThrow();
  });

  it('should throw if participants exceed capacity — AC: max 4 équipes/poule pour doubles', () => {
    // 9 players into 2 double pools = 4.5 teams/pool > 4 max
    const players = Array.from({ length: 9 }, (_, i) => `p${i + 1}`);
    expect(() => distributeIntoPools(players, 2, 'double-homme')).toThrow();
  });

  it('should allow up to 5 participants per pool for singles — AC: max 5 simples/poule', () => {
    const players = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const result = distributeIntoPools(players, 2, 'simple-homme');
    result.forEach((pool) => expect(pool.length).toBeLessThanOrEqual(5));
  });

  it('should allow up to 4 participants per pool for doubles — AC: max 4 équipes/poule', () => {
    const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const result = distributeIntoPools(players, 2, 'double-homme');
    result.forEach((pool) => expect(pool.length).toBeLessThanOrEqual(4));
  });

  it('should work for mixte doubles — AC: max 4 équipes/poule (double/mixte)', () => {
    const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const result = distributeIntoPools(players, 2, 'double-mixte');
    result.forEach((pool) => expect(pool.length).toBeLessThanOrEqual(4));
  });

  it('should throw for poolCount <= 0', () => {
    expect(() => distributeIntoPools(['p1', 'p2'], 0, 'simple-homme')).toThrow();
  });

  it('should handle single pool with all participants', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const result = distributeIntoPools(players, 1, 'simple-homme');
    expect(result).toHaveLength(1);
    expect(result[0].sort()).toEqual([...players].sort());
  });

  it('should use custom RNG for deterministic testing — AC: relancer le tirage', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const deterministicRng = vi.fn().mockReturnValue(0);
    const result = distributeIntoPools(players, 2, 'simple-homme', deterministicRng);
    expect(deterministicRng).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });
});

// ========================
// PoolService tests
// ========================

describe('PoolService', () => {
  let service: PoolService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the batch mock (accessed via globalThis because vi.mock is hoisted)
    const batch = (globalThis as any).__mockBatch;
    if (batch) {
      batch.delete.mockClear();
      batch.update.mockClear();
      batch.commit.mockClear().mockResolvedValue(undefined);
    }

    const { Firestore, collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

    TestBed.configureTestingModule({
      providers: [
        PoolService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(PoolService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- generatePools() ---

  it('generatePools() should return correct number of pools — AC: répartition selon config poules', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const pools = service.generatePools('t1', 'simple-homme', 2, players);
    expect(pools).toHaveLength(2);
  });

  it('generatePools() should assign all participants — AC: répartition aléatoire des participants', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const pools = service.generatePools('t1', 'simple-homme', 2, players);
    const allMembers = pools.flatMap((p) => p.memberIds);
    expect(allMembers.sort()).toEqual([...players].sort());
  });

  it('generatePools() should set locked to false — pools not locked until validated', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const pools = service.generatePools('t1', 'simple-homme', 2, players);
    pools.forEach((pool) => expect(pool.locked).toBe(false));
  });

  it('generatePools() should set correct poolNumber (1-indexed)', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const pools = service.generatePools('t1', 'simple-homme', 3, players);
    pools.forEach((pool, index) => expect(pool.poolNumber).toBe(index + 1));
  });

  it('generatePools() should set correct tournamentId and gameType', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const pools = service.generatePools('t1', 'double-femme', 2, players);
    pools.forEach((pool) => {
      expect(pool.tournamentId).toBe('t1');
      expect(pool.gameType).toBe('double-femme');
    });
  });

  it('generatePools() should produce different orderings on re-draw — AC: admin peut relancer le tirage', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    // Use real Math.random — run many times to check randomness statistically
    const draws = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const pools = service.generatePools('t1', 'simple-homme', 2, players);
      draws.add(pools.map((p) => p.memberIds.join(',')).join('|'));
    }
    // With 8 players and 20 draws, we expect more than 1 unique draw
    expect(draws.size).toBeGreaterThan(1);
  });

  it('generatePools() with deterministic RNG should produce predictable results', () => {
    const players = ['p1', 'p2', 'p3', 'p4'];
    const rng = vi.fn().mockReturnValue(0);
    const pools1 = service.generatePools('t1', 'simple-homme', 2, players, rng);
    rng.mockClear();
    rng.mockReturnValue(0);
    const pools2 = service.generatePools('t1', 'simple-homme', 2, players, rng);
    expect(pools1.map((p) => p.memberIds)).toEqual(pools2.map((p) => p.memberIds));
  });

  it('generatePools() should throw when capacity exceeded — AC: max 5 simples/poule', () => {
    const players = Array.from({ length: 11 }, (_, i) => `p${i + 1}`);
    expect(() => service.generatePools('t1', 'simple-homme', 2, players)).toThrow();
  });

  it('generatePools() should throw when doubles capacity exceeded — AC: max 4 équipes/poule', () => {
    const players = Array.from({ length: 9 }, (_, i) => `p${i + 1}`);
    expect(() => service.generatePools('t1', 'double-homme', 2, players)).toThrow();
  });

  // --- savePools() ---

  it('savePools() should write pools to Firestore — AC: écriture dans pools', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const pools = [
      { id: '', tournamentId: 't1', gameType: 'simple-homme' as const, poolNumber: 1, memberIds: ['p1', 'p2'], locked: false },
      { id: '', tournamentId: 't1', gameType: 'simple-homme' as const, poolNumber: 2, memberIds: ['p3', 'p4'], locked: false },
    ];

    const saved = await service.savePools(pools);
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(saved).toHaveLength(2);
    expect(saved[0].id).toBe('pool-id-1');
  });

  it('savePools() should delete existing pools before saving new ones — AC: relancer le tirage remplace les poules', async () => {
    const { getDocs } = await import('@angular/fire/firestore');
    const mockDoc1 = { ref: { path: 'pool1' } };
    const mockDoc2 = { ref: { path: 'pool2' } };
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [mockDoc1, mockDoc2],
      empty: false,
    } as any);

    const pools = [
      { id: '', tournamentId: 't1', gameType: 'simple-homme' as const, poolNumber: 1, memberIds: ['p1', 'p2'], locked: false },
    ];

    await service.savePools(pools);
    const batch = (globalThis as any).__mockBatch;
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalled();
  });

  it('savePools() should return empty array when called with no pools', async () => {
    const result = await service.savePools([]);
    expect(result).toEqual([]);
  });

  // --- lockPools() ---

  it('lockPools() should update all pools with locked=true — AC: validation → poules figées', async () => {
    const { getDocs } = await import('@angular/fire/firestore');
    const mockDoc1 = { ref: { path: 'pool1' } };
    const mockDoc2 = { ref: { path: 'pool2' } };
    vi.mocked(getDocs)
      .mockResolvedValueOnce({ docs: [mockDoc1, mockDoc2], empty: false } as any)
      .mockResolvedValueOnce({ docs: [{ data: () => ({}) }], empty: false } as any)
      .mockResolvedValueOnce({ docs: [{ data: () => ({}) }], empty: false } as any);

    await service.lockPools('t1', 'simple-homme');

    const batch = (globalThis as any).__mockBatch;
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenCalledWith(expect.anything(), { locked: true });
  });

  it('lockPools() should transition tournament to "En cours" when all game types have locked pools — AC: tournoi passe En cours', async () => {
    const { getDocs, updateDoc, getDoc } = await import('@angular/fire/firestore');

    // First getDocs: returns pools to lock
    // Second/Third getDocs: returns locked pools for each configured game type (both locked)
    vi.mocked(getDocs)
      .mockResolvedValueOnce({ docs: [{ ref: { path: 'pool1' } }], empty: false } as any)
      .mockResolvedValueOnce({ docs: [{ data: () => ({}) }], empty: false } as any)
      .mockResolvedValueOnce({ docs: [{ data: () => ({}) }], empty: false } as any);

    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        poolConfig: [
          { gameType: 'simple-homme', poolCount: 2 },
        ],
        status: 'Inscriptions clôturées',
      }),
    } as any);

    await service.lockPools('t1', 'simple-homme');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { status: 'En cours' }
    );
  });

  it('lockPools() should NOT transition tournament when some game types are still unlocked', async () => {
    const { getDocs, updateDoc, getDoc } = await import('@angular/fire/firestore');

    // Order of getDocs calls in lockPools:
    //   1. getDocs → find pools to lock (for 'simple-homme')
    //   2+ getDocs → in checkAndStartTournament, one per configured game type checking locked pools
    //   Tournament has 2 game types: simple-homme (locked) and simple-femme (NOT locked yet)
    vi.mocked(getDocs).mockImplementation((q: any): any => {
      // We can't inspect query predicates easily, so use call count
      const callCount = vi.mocked(getDocs).mock.calls.length;
      if (callCount === 1) {
        // First call: finding pools to update (locking)
        return Promise.resolve({ docs: [{ ref: { path: 'pool1' } }], empty: false });
      } else if (callCount === 2) {
        // Second call: checking simple-homme locked — return a locked pool
        return Promise.resolve({ docs: [{ data: () => ({ locked: true }) }], empty: false });
      } else {
        // Third call and beyond: simple-femme NOT locked
        return Promise.resolve({ docs: [], empty: true });
      }
    });

    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        poolConfig: [
          { gameType: 'simple-homme', poolCount: 2 },
          { gameType: 'simple-femme', poolCount: 2 },
        ],
        status: 'Inscriptions clôturées',
      }),
    } as any);

    // Clear updateDoc before the call to only check calls from this test
    vi.mocked(updateDoc).mockClear();

    await service.lockPools('t1', 'simple-homme');

    // updateDoc should NOT have been called with 'En cours'
    const updateDocCalls = vi.mocked(updateDoc).mock.calls;
    const enCoursCall = updateDocCalls.find(
      (call) => (call[1] as any)?.status === 'En cours'
    );
    expect(enCoursCall).toBeUndefined();
  });

  // --- getPools() ---

  it('getPools() should return observable of pools', async () => {
    const { collectionData } = await import('@angular/fire/firestore');
    const mockPools = [
      { id: 'pool1', tournamentId: 't1', gameType: 'simple-homme', poolNumber: 1, memberIds: ['p1', 'p2'], locked: false },
    ];
    vi.mocked(collectionData).mockReturnValueOnce(of(mockPools) as any);

    const result$ = service.getPools('t1');
    return new Promise<void>((resolve) => {
      result$.subscribe((pools) => {
        expect(pools).toHaveLength(1);
        resolve();
      });
    });
  });

  it('getPools() with gameType should filter by game type', async () => {
    const { where, collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValueOnce(of([]) as any);

    service.getPools('t1', 'simple-homme');
    expect(where).toHaveBeenCalledWith('gameType', '==', 'simple-homme');
  });

  // --- getPoolsForPlayer() ---

  it('getPoolsForPlayer() should query pools containing the player — AC: joueurs peuvent consulter leur poule', async () => {
    const { where, collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValueOnce(of([]) as any);

    service.getPoolsForPlayer('t1', 'player-1');
    expect(where).toHaveBeenCalledWith('memberIds', 'array-contains', 'player-1');
  });
});
