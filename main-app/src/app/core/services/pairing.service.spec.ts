import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { PairingService } from './pairing.service';
import { Pair } from '../models/pairing.model';

// Shared mock batch object — referenced by writeBatch factory
const mockBatch = {
  update: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@angular/fire/firestore', () => {
  const _mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    Firestore: class MockFirestore {},
    collection: vi.fn().mockReturnValue({ path: 'tournaments/t1/pairs' }),
    collectionData: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'pair-id-1' }),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    doc: vi.fn().mockReturnValue({ path: 'tournaments/t1/pairs/p1' }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn().mockImplementation((ref: unknown) => ref),
    where: vi.fn().mockReturnValue({}),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    writeBatch: vi.fn().mockReturnValue(_mockBatch),
    _mockBatch,
  };
});

const makePairs = (count: number, tournamentId = 't1', gameType: Pair['gameType'] = 'double-homme'): Pair[] =>
  Array.from({ length: count / 2 }, (_, i) => ({
    id: `pair-${i}`,
    tournamentId,
    gameType,
    player1Id: `p${i * 2}`,
    player2Id: `p${i * 2 + 1}`,
    locked: false,
  }));

describe('PairingService', () => {
  let service: PairingService;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockBatch.update.mockClear();
    mockBatch.commit.mockResolvedValue(undefined);

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of(makePairs(4)) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [PairingService, { provide: Firestore, useValue: {} }],
    });

    service = TestBed.inject(PairingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- shuffleFisherYates() ---

  it('shuffleFisherYates() should return an array of the same length — AC: Fisher-Yates', () => {
    const input = ['a', 'b', 'c', 'd'];
    const result = service.shuffleFisherYates([...input]);
    expect(result).toHaveLength(input.length);
  });

  it('shuffleFisherYates() should contain the same elements — AC: Fisher-Yates', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = service.shuffleFisherYates([...input]);
    expect(result.sort()).toEqual(input.sort());
  });

  it('shuffleFisherYates() should return empty array for empty input — AC: Fisher-Yates', () => {
    expect(service.shuffleFisherYates([])).toEqual([]);
  });

  // --- generatePairs() ---

  it('generatePairs() should return N/2 pairs for N even players — AC: appariement 2 par 2', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4'];
    const pairs = service.generatePairs('t1', 'double-homme', playerIds);
    expect(pairs).toHaveLength(2);
  });

  it('generatePairs() should throw for odd number of players — AC: blocage si impair', () => {
    expect(() => service.generatePairs('t1', 'double-homme', ['p1', 'p2', 'p3'])).toThrow(
      /impair/i
    );
  });

  it('generatePairs() should throw with 1 player — AC: blocage si impair', () => {
    expect(() => service.generatePairs('t1', 'double-mixte', ['p1'])).toThrow(/impair/i);
  });

  it('generatePairs() should not throw for 0 players — AC: edge case vide', () => {
    expect(() => service.generatePairs('t1', 'double-femme', [])).not.toThrow();
    expect(service.generatePairs('t1', 'double-femme', [])).toHaveLength(0);
  });

  it('generatePairs() each pair should have player1Id and player2Id — AC: structure de la paire', () => {
    const pairs = service.generatePairs('t1', 'double-homme', ['p1', 'p2', 'p3', 'p4']);
    for (const pair of pairs) {
      expect(pair.player1Id).toBeTruthy();
      expect(pair.player2Id).toBeTruthy();
      expect(pair.player1Id).not.toBe(pair.player2Id);
    }
  });

  it('generatePairs() should include all players exactly once — AC: appariement 2 par 2', () => {
    const playerIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const pairs = service.generatePairs('t1', 'double-homme', playerIds);
    const allPlayers = pairs.flatMap((p) => [p.player1Id, p.player2Id]);
    expect(new Set(allPlayers).size).toBe(playerIds.length);
    expect(allPlayers.sort()).toEqual(playerIds.sort());
  });

  it('generatePairs() pairs should have locked=false — AC: paires non verrouillées initialement', () => {
    const pairs = service.generatePairs('t1', 'double-homme', ['p1', 'p2']);
    expect(pairs[0].locked).toBe(false);
  });

  it('generatePairs() should set correct tournamentId and gameType — AC: structure', () => {
    const pairs = service.generatePairs('t1', 'double-mixte', ['p1', 'p2']);
    expect(pairs[0].tournamentId).toBe('t1');
    expect(pairs[0].gameType).toBe('double-mixte');
  });

  // --- getPairs() ---

  it('getPairs() should return an Observable of Pair[] — AC: lecture des paires', () => {
    return new Promise<void>((resolve) => {
      service.getPairs('t1', 'double-homme').subscribe((pairs) => {
        expect(Array.isArray(pairs)).toBe(true);
        resolve();
      });
    });
  });

  it('getPairs() should call collection with correct path — AC: sous-collection pairs', async () => {
    const { collection } = await import('@angular/fire/firestore');
    service.getPairs('t1', 'double-homme');
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'tournaments', 't1', 'pairs');
  });

  it('getPairs() should filter by gameType — AC: filtre par type de jeu', async () => {
    const { where } = await import('@angular/fire/firestore');
    service.getPairs('t1', 'double-mixte');
    expect(where).toHaveBeenCalledWith('gameType', '==', 'double-mixte');
  });

  // --- savePairs() ---

  it('savePairs() should call addDoc for each pair — AC: écriture dans pairs', async () => {
    const { addDoc, getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const pairs: Pair[] = [
      { id: '', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: false },
      { id: '', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p3', player2Id: 'p4', locked: false },
    ];

    await service.savePairs('t1', 'double-homme', pairs);
    expect(addDoc).toHaveBeenCalledTimes(2);
  });

  it('savePairs() should call addDoc with correct data — AC: écriture dans pairs', async () => {
    const { addDoc, getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    const pairs: Pair[] = [
      { id: '', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: false },
    ];

    await service.savePairs('t1', 'double-homme', pairs);

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        player1Id: 'p1',
        player2Id: 'p2',
        gameType: 'double-homme',
        locked: false,
      })
    );
  });

  // --- lockPairs() ---

  it('lockPairs() should call writeBatch and commit — AC: paires figées après validation', async () => {
    const firestore = await import('@angular/fire/firestore');
    const { getDocs, writeBatch: wbMock } = firestore;
    const innerBatch = (firestore as any)._mockBatch;

    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'pair-1' }, { id: 'pair-2' }],
    } as any);

    innerBatch.update.mockClear();
    innerBatch.commit.mockClear();
    innerBatch.commit.mockResolvedValue(undefined);

    await service.lockPairs('t1', 'double-homme');

    expect(wbMock).toHaveBeenCalled();
    expect(innerBatch.update).toHaveBeenCalledTimes(2);
    expect(innerBatch.commit).toHaveBeenCalled();
  });

  it('lockPairs() should update each pair with locked=true — AC: paires figées', async () => {
    const firestore = await import('@angular/fire/firestore');
    const { getDocs } = firestore;
    const innerBatch = (firestore as any)._mockBatch;

    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'pair-1' }],
    } as any);

    innerBatch.update.mockClear();
    innerBatch.commit.mockClear();
    innerBatch.commit.mockResolvedValue(undefined);

    await service.lockPairs('t1', 'double-homme');

    expect(innerBatch.update).toHaveBeenCalledWith(
      expect.anything(),
      { locked: true }
    );
  });

  // --- resetPairs() ---

  it('resetPairs() should call deleteDoc for each unlocked pair — AC: relancer le tirage', async () => {
    const { deleteDoc, getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'pair-1' }, { id: 'pair-2' }],
    } as any);

    await service.resetPairs('t1', 'double-homme');
    expect(deleteDoc).toHaveBeenCalledTimes(2);
  });

  it('resetPairs() should query for unlocked pairs only — AC: ne pas supprimer les paires verrouillées', async () => {
    const { where } = await import('@angular/fire/firestore');
    await service.resetPairs('t1', 'double-femme');
    expect(where).toHaveBeenCalledWith('locked', '==', false);
  });

  // --- updatePair() ---

  it('updatePair() should call updateDoc with new player IDs — AC: modification manuelle', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    await service.updatePair('t1', 'pair-1', 'p5', 'p6', false);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ player1Id: 'p5', player2Id: 'p6' })
    );
  });

  it('updatePair() should throw if pair is locked — AC: non modifiable sans reset', async () => {
    await expect(service.updatePair('t1', 'pair-1', 'p5', 'p6', true)).rejects.toThrow(
      /verrouillée/i
    );
  });
});
