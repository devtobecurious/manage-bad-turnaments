import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { TournamentService } from './tournament.service';
import { Tournament } from '../models/tournament.model';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'tournaments' }),
  collectionData: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'generated-tournament-id' }),
  doc: vi.fn().mockReturnValue({ path: 'tournaments/tournament-1' }),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 'tournament-1',
    data: () => ({
      name: 'Tournoi Printemps',
      date: '2026-06-01',
      description: 'Tournoi de printemps',
      gameTypes: ['simple-homme', 'simple-femme'],
      status: 'Brouillon',
      createdAt: '2026-05-13T12:00:00Z',
    }),
  }),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
}));

const mockTournaments: Tournament[] = [
  {
    id: 't1',
    name: 'Tournoi Été',
    date: '2026-07-15',
    gameTypes: ['simple-homme', 'double-femme'],
    status: 'Brouillon',
    createdAt: '2026-05-01T00:00:00Z',
  },
  {
    id: 't2',
    name: 'Tournoi Automne',
    date: '2026-10-10',
    description: 'Grand tournoi automnal',
    gameTypes: ['mixte'],
    status: 'Inscriptions ouvertes',
    createdAt: '2026-05-02T00:00:00Z',
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

  it('getTournaments() should return tournaments with required fields', () => {
    return new Promise<void>((resolve) => {
      service.getTournaments().subscribe((tournaments) => {
        const t = tournaments[0];
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('date');
        expect(t).toHaveProperty('gameTypes');
        expect(t).toHaveProperty('status');
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
    const result = await service.getTournament('tournament-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('tournament-1');
    expect(result?.name).toBe('Tournoi Printemps');
  });

  // --- createTournament() — AC coverage ---

  it('createTournament() should write name, date, and gameTypes to Firestore — AC: saisie nom/date', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createTournament({
      name: 'Tournoi Hiver',
      date: '2026-12-15',
      gameTypes: ['simple-homme', 'simple-femme'],
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Tournoi Hiver',
        date: '2026-12-15',
        gameTypes: ['simple-homme', 'simple-femme'],
      })
    );
  });

  it('createTournament() should write optional description when provided — AC: description optionnelle', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createTournament({
      name: 'Tournoi Hiver',
      date: '2026-12-15',
      description: 'Une description',
      gameTypes: ['mixte'],
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ description: 'Une description' })
    );
  });

  it('createTournament() should not include description when omitted — AC: description optionnelle', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createTournament({
      name: 'Tournoi Hiver',
      date: '2026-12-15',
      gameTypes: ['mixte'],
    });

    const callArg = vi.mocked(addDoc).mock.calls[0][1] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('description');
  });

  it('createTournament() should save multi-select gameTypes array — AC: multi-types de jeu', async () => {
    const gameTypes = ['simple-homme', 'simple-femme', 'double-homme', 'double-femme', 'mixte'] as const;

    const result = await service.createTournament({
      name: 'Tournoi Complet',
      date: '2026-08-01',
      gameTypes: [...gameTypes],
    });

    expect(result.gameTypes).toEqual([...gameTypes]);
  });

  it('createTournament() should set status to Brouillon — AC: statut Brouillon', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createTournament({
      name: 'Tournoi Test',
      date: '2026-09-01',
      gameTypes: ['mixte'],
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'Brouillon' })
    );
  });

  it('createTournament() should return status Brouillon on the returned tournament — AC: statut Brouillon', async () => {
    const result = await service.createTournament({
      name: 'Tournoi Test',
      date: '2026-09-01',
      gameTypes: ['simple-homme'],
    });

    expect(result.status).toBe('Brouillon');
  });

  it('createTournament() should return a tournament with a unique id from Firestore — AC: identifiant unique', async () => {
    const result = await service.createTournament({
      name: 'Tournoi ID Test',
      date: '2026-09-15',
      gameTypes: ['double-mixte' as any],
    });

    expect(result.id).toBe('generated-tournament-id');
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('createTournament() should return tournament with all provided fields — AC: saisie complète', async () => {
    const { addDoc } = await import('@angular/fire/firestore');
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'new-id' } as never);

    const result = await service.createTournament({
      name: 'Tournoi Complet',
      date: '2026-11-01',
      description: 'Desc',
      gameTypes: ['simple-homme', 'mixte'],
    });

    expect(result.name).toBe('Tournoi Complet');
    expect(result.date).toBe('2026-11-01');
    expect(result.description).toBe('Desc');
    expect(result.gameTypes).toEqual(['simple-homme', 'mixte']);
    expect(result.createdAt).toBeTruthy();
  });
});
