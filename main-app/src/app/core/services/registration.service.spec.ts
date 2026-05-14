import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { RegistrationService } from './registration.service';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'tournaments/t1/registrations' }),
  collectionGroup: vi.fn().mockReturnValue({ path: 'registrations' }),
  collectionData: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'reg-id-1' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn().mockReturnValue({ path: 'tournaments/t1' }),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ status: 'Inscriptions ouvertes' }),
  }),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  query: vi.fn().mockImplementation((ref) => ref),
  where: vi.fn().mockReturnValue({}),
}));

describe('RegistrationService', () => {
  let service: RegistrationService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData, collectionGroup } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of([]) as any);
    vi.mocked(collectionGroup).mockReturnValue({ path: 'registrations' } as any);

    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ status: 'Inscriptions ouvertes' }),
    } as any);

    const { getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as any);

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        RegistrationService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(RegistrationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // --- getOpenTournaments() — AC: liste des tournois ouverts ---

  it('getOpenTournaments() should query tournaments with status "Inscriptions ouvertes" — AC: liste des tournois ouverts', async () => {
    const { where } = await import('@angular/fire/firestore');

    service.getOpenTournaments().subscribe();

    expect(where).toHaveBeenCalledWith('status', '==', 'Inscriptions ouvertes');
  });

  it('getOpenTournaments() should return an Observable — AC: liste des tournois ouverts', () => {
    return new Promise<void>((resolve) => {
      service.getOpenTournaments().subscribe((tournaments) => {
        expect(Array.isArray(tournaments)).toBe(true);
        resolve();
      });
    });
  });

  // --- registerForTournament() — AC: inscription ---

  it('registerForTournament should call addDoc in the registrations subcollection — AC: inscription', async () => {
    const { addDoc, collection } = await import('@angular/fire/firestore');

    await service.registerForTournament('t1', 'player-1', 'simple homme');

    expect(addDoc).toHaveBeenCalled();
    expect(collection).toHaveBeenCalledWith(expect.anything(), 'tournaments', 't1', 'registrations');
  });

  it('registerForTournament should return a Registration object — AC: confirmation d\'inscription', async () => {
    const result = await service.registerForTournament('t1', 'player-1', 'simple homme');

    expect(result.id).toBe('reg-id-1');
    expect(result.tournamentId).toBe('t1');
    expect(result.playerId).toBe('player-1');
    expect(result.gameType).toBe('simple homme');
    expect(result.registeredAt).toBeDefined();
  });

  it('registerForTournament should store correct data in Firestore — AC: inscription', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.registerForTournament('t1', 'player-1', 'mixte');

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tournamentId: 't1',
        playerId: 'player-1',
        gameType: 'mixte',
      })
    );
  });

  it('registerForTournament should throw if tournament is not open — AC: inscriptions ouvertes uniquement', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'Brouillon' }),
    } as any);

    await expect(
      service.registerForTournament('t1', 'player-1', 'simple homme')
    ).rejects.toThrow("Le tournoi n'est pas ouvert aux inscriptions.");
  });

  it('registerForTournament should throw if tournament does not exist — AC: inscriptions ouvertes uniquement', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    } as any);

    await expect(
      service.registerForTournament('unknown', 'player-1', 'simple homme')
    ).rejects.toThrow("Le tournoi n'est pas ouvert aux inscriptions.");
  });

  it('registerForTournament should throw if player is already registered for same gameType — AC: idempotence', async () => {
    const { getDocs } = await import('@angular/fire/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'existing-reg' }],
    } as any);

    await expect(
      service.registerForTournament('t1', 'player-1', 'simple homme')
    ).rejects.toThrow('Le joueur est déjà inscrit pour ce type de jeu dans ce tournoi.');
  });

  // --- unregisterFromTournament() — AC: désinscription ---

  it('unregisterFromTournament should call deleteDoc on the registration — AC: désinscription possible', async () => {
    const { deleteDoc } = await import('@angular/fire/firestore');

    await service.unregisterFromTournament('t1', 'reg-id-1');

    expect(deleteDoc).toHaveBeenCalled();
  });

  it('unregisterFromTournament should reference the correct subcollection path — AC: désinscription possible', async () => {
    const { doc } = await import('@angular/fire/firestore');

    await service.unregisterFromTournament('t1', 'reg-id-1');

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      'tournaments',
      't1',
      'registrations',
      'reg-id-1'
    );
  });

  it('unregisterFromTournament should throw if tournament is no longer open — AC: désinscription uniquement si inscriptions ouvertes', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'En cours' }),
    } as any);

    await expect(
      service.unregisterFromTournament('t1', 'reg-id-1')
    ).rejects.toThrow("La désinscription n'est plus possible : les inscriptions sont fermées.");
  });

  it('unregisterFromTournament should throw if tournament does not exist — AC: désinscription uniquement si inscriptions ouvertes', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    } as any);

    await expect(
      service.unregisterFromTournament('unknown', 'reg-id-1')
    ).rejects.toThrow("La désinscription n'est plus possible : les inscriptions sont fermées.");
  });

  // --- getPlayerRegistrations() ---

  it('getPlayerRegistrations() should use collectionGroup to query across all tournaments — AC: historique inscriptions', async () => {
    const { collectionGroup, where } = await import('@angular/fire/firestore');

    service.getPlayerRegistrations('player-1').subscribe();

    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), 'registrations');
    expect(where).toHaveBeenCalledWith('playerId', '==', 'player-1');
  });

  it('getPlayerRegistrations() should return an Observable — AC: historique inscriptions', () => {
    return new Promise<void>((resolve) => {
      service.getPlayerRegistrations('player-1').subscribe((registrations) => {
        expect(Array.isArray(registrations)).toBe(true);
        resolve();
      });
    });
  });
});
