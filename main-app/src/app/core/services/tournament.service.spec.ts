import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { TournamentService } from './tournament.service';
import { Tournament, PoolConfig } from '../models/tournament.model';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'tournaments' }),
  collectionData: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'generated-tournament-id' }),
  doc: vi.fn().mockReturnValue({ path: 'tournaments/t1' }),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 't1',
    data: () => ({
      name: 'Tournoi Printemps',
      date: '2026-06-01',
      status: 'draft',
      gameTypes: ['simple-homme'],
      poolConfig: [],
      createdAt: '2026-05-13T12:00:00Z',
      createdBy: 'admin-uid',
    }),
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
}));

const mockTournaments: Tournament[] = [
  {
    id: 't1',
    name: 'Tournoi Printemps',
    date: '2026-06-01',
    status: 'draft',
    gameTypes: ['simple-homme', 'simple-femme'],
    poolConfig: [],
    createdAt: '2026-05-13T12:00:00Z',
    createdBy: 'admin-uid',
  },
  {
    id: 't2',
    name: 'Tournoi Automne',
    date: '2026-10-01',
    status: 'open',
    gameTypes: ['double-mixte'],
    poolConfig: [{ gameType: 'double-mixte', poolCount: 2, qualifiersPerPool: 1 }],
    createdAt: '2026-05-13T12:00:00Z',
    createdBy: 'admin-uid',
  },
];

describe('TournamentService', () => {
  let service: TournamentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of(mockTournaments) as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        TournamentService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(TournamentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- getTournaments() ---

  it('getTournaments() should return an Observable of tournaments', () => {
    return new Promise<void>((resolve) => {
      service.getTournaments().subscribe((tournaments) => {
        expect(tournaments).toHaveLength(2);
        resolve();
      });
    });
  });

  it('getTournaments() should return tournaments with poolConfig field', () => {
    return new Promise<void>((resolve) => {
      service.getTournaments().subscribe((tournaments) => {
        expect(tournaments[1].poolConfig).toHaveLength(1);
        expect(tournaments[1].poolConfig[0].gameType).toBe('double-mixte');
        resolve();
      });
    });
  });

  // --- getTournament() ---

  it('getTournament() should return null when tournament does not exist', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);

    const result = await service.getTournament('unknown-id');
    expect(result).toBeNull();
  });

  it('getTournament() should return tournament data when document exists', async () => {
    const result = await service.getTournament('t1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('t1');
    expect(result?.name).toBe('Tournoi Printemps');
  });

  // --- createTournament() ---

  it('createTournament() should call addDoc and return a tournament with id', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const result = await service.createTournament({
      name: 'Nouveau Tournoi',
      date: '2026-07-15',
      createdBy: 'admin-uid',
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.id).toBe('generated-tournament-id');
    expect(result.name).toBe('Nouveau Tournoi');
    expect(result.status).toBe('draft');
    expect(result.poolConfig).toEqual([]);
  });

  // --- updatePoolConfig() — US-006 acceptance criteria ---

  it('updatePoolConfig() should call updateDoc with poolConfig — AC: configurer le format de poules', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const configs: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 3, qualifiersPerPool: 2 },
    ];

    await service.updatePoolConfig('t1', configs);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: configs }
    );
  });

  it('updatePoolConfig() should support multiple game types independently — AC: config indépendante par type de jeu', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const configs: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 2, qualifiersPerPool: 1 },
      { gameType: 'simple-femme', poolCount: 3, qualifiersPerPool: 2 },
      { gameType: 'double-mixte', poolCount: 1, qualifiersPerPool: 0 },
    ];

    await service.updatePoolConfig('t1', configs);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: configs }
    );
  });

  it('updatePoolConfig() should allow qualifiersPerPool of 1 — AC: qualifiés 1 ou 2', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const configs: PoolConfig[] = [
      { gameType: 'simple-homme', poolCount: 4, qualifiersPerPool: 1 },
    ];

    await service.updatePoolConfig('t1', configs);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: [{ gameType: 'simple-homme', poolCount: 4, qualifiersPerPool: 1 }] }
    );
  });

  it('updatePoolConfig() should allow qualifiersPerPool of 2 — AC: qualifiés 1 ou 2', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const configs: PoolConfig[] = [
      { gameType: 'double-homme', poolCount: 2, qualifiersPerPool: 2 },
    ];

    await service.updatePoolConfig('t1', configs);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: [{ gameType: 'double-homme', poolCount: 2, qualifiersPerPool: 2 }] }
    );
  });

  it('updatePoolConfig() should allow 1 pool + 0 qualifiers (no final phase) — AC: 1 poule / 0 qualifié = pas de finale', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const configs: PoolConfig[] = [
      { gameType: 'simple-femme', poolCount: 1, qualifiersPerPool: 0 },
    ];

    await service.updatePoolConfig('t1', configs);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: [{ gameType: 'simple-femme', poolCount: 1, qualifiersPerPool: 0 }] }
    );
  });

  it('updatePoolConfig() should call doc with correct tournament ID', async () => {
    const { doc } = await import('@angular/fire/firestore');

    await service.updatePoolConfig('tournament-xyz', []);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'tournaments', 'tournament-xyz');
  });

  it('updatePoolConfig() should support empty config array', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    await service.updatePoolConfig('t1', []);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { poolConfig: [] }
    );
  });
});
