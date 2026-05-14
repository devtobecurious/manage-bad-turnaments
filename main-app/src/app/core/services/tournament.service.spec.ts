import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { TournamentService } from './tournament.service';

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
      status: 'Brouillon',
      participationToken: null,
      createdBy: 'admin-uid-1',
      createdAt: '2026-05-13T12:00:00Z',
    }),
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
}));

describe('TournamentService', () => {
  let service: TournamentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);

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
        expect(Array.isArray(tournaments)).toBe(true);
        resolve();
      });
    });
  });

  // --- createTournament() ---

  it('createTournament should write to Firestore and return a tournament with Brouillon status', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const result = await service.createTournament({
      name: 'Tournoi Été',
      date: '2026-07-15',
      createdBy: 'admin-uid-1',
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.id).toBe('generated-tournament-id');
    expect(result.name).toBe('Tournoi Été');
    expect(result.status).toBe('Brouillon');
    expect(result.participationToken).toBeNull();
  });

  it('createTournament should store status as Brouillon — AC: statut initial Brouillon', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.createTournament({
      name: 'Tournoi Test',
      date: '2026-08-01',
      createdBy: 'admin-uid-1',
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'Brouillon',
        participationToken: null,
      })
    );
  });

  // --- publishTournament() — AC: Brouillon → Inscriptions ouvertes ---

  it('publishTournament should update status to "Inscriptions ouvertes" — AC: passage Brouillon → Inscriptions ouvertes', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    await service.publishTournament('t1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'Inscriptions ouvertes',
      })
    );
  });

  it('publishTournament should generate a participationToken — AC: lien unique de participation', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    const token = await service.publishTournament('t1');

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        participationToken: token,
      })
    );
  });

  it('publishTournament should call doc with correct tournament ID', async () => {
    const { doc } = await import('@angular/fire/firestore');

    await service.publishTournament('tournament-abc');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'tournaments', 'tournament-abc');
  });

  it('publishTournament should return a UUID string as token — AC: lien unique', async () => {
    const token = await service.publishTournament('t1');
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(token)).toBe(true);
  });

  // --- getTournament() ---

  it('getTournament should return null when tournament does not exist', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);

    const result = await service.getTournament('unknown-id');
    expect(result).toBeNull();
  });

  it('getTournament should return tournament data when document exists', async () => {
    const result = await service.getTournament('t1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('t1');
    expect(result?.name).toBe('Tournoi Printemps');
  });

  // --- closeRegistrations() — AC: Inscriptions ouvertes → Inscriptions clôturées ---

  it('closeRegistrations should update status to "Inscriptions clôturées" — AC: passage statut clôturé', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    await service.closeRegistrations('t1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'Inscriptions clôturées',
      })
    );
  });

  it('closeRegistrations should call doc with correct tournament ID', async () => {
    const { doc } = await import('@angular/fire/firestore');

    await service.closeRegistrations('tournament-xyz');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'tournaments', 'tournament-xyz');
  });

  it('closeRegistrations should only update status, not participationToken', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');

    await service.closeRegistrations('t1');

    const callArg = vi.mocked(updateDoc).mock.calls[0][1] as unknown as Record<string, unknown>;
    expect(Object.keys(callArg)).toEqual(['status']);
  });

  // --- canRegister() — AC: Aucune nouvelle inscription possible après la clôture ---

  it('canRegister should return true when status is "Inscriptions ouvertes" — AC: inscription autorisée', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 't1',
      data: () => ({
        name: 'Tournoi Test',
        date: '2026-06-01',
        status: 'Inscriptions ouvertes',
        participationToken: 'some-token',
        createdBy: 'admin-uid-1',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    } as never);

    const result = await service.canRegister('t1');
    expect(result).toBe(true);
  });

  it('canRegister should return false when status is "Inscriptions clôturées" — AC: inscription bloquée', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 't1',
      data: () => ({
        name: 'Tournoi Test',
        date: '2026-06-01',
        status: 'Inscriptions clôturées',
        participationToken: 'some-token',
        createdBy: 'admin-uid-1',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    } as never);

    const result = await service.canRegister('t1');
    expect(result).toBe(false);
  });

  it('canRegister should return false when status is "Brouillon"', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 't1',
      data: () => ({
        name: 'Tournoi Test',
        date: '2026-06-01',
        status: 'Brouillon',
        participationToken: null,
        createdBy: 'admin-uid-1',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    } as never);

    const result = await service.canRegister('t1');
    expect(result).toBe(false);
  });

  it('canRegister should return false when status is "En cours"', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 't1',
      data: () => ({
        name: 'Tournoi Test',
        date: '2026-06-01',
        status: 'En cours',
        participationToken: 'some-token',
        createdBy: 'admin-uid-1',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    } as never);

    const result = await service.canRegister('t1');
    expect(result).toBe(false);
  });

  it('canRegister should return false when status is "Terminé"', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: 't1',
      data: () => ({
        name: 'Tournoi Test',
        date: '2026-06-01',
        status: 'Terminé',
        participationToken: 'some-token',
        createdBy: 'admin-uid-1',
        createdAt: '2026-05-13T12:00:00Z',
      }),
    } as never);

    const result = await service.canRegister('t1');
    expect(result).toBe(false);
  });

  it('canRegister should return false when tournament does not exist', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);

    const result = await service.canRegister('non-existent-id');
    expect(result).toBe(false);
  });
});
