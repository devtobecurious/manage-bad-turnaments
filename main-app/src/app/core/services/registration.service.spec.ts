import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { RegistrationService } from './registration.service';
import { Registration } from '../models/registration.model';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'tournaments/t1/registrations' }),
  collectionData: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'generated-reg-id' }),
  doc: vi.fn().mockReturnValue({ path: 'tournaments/t1/registrations/r1' }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
}));

const mockRegistrations: Registration[] = [
  {
    id: 'r1',
    tournamentId: 't1',
    playerId: 'p1',
    gameType: 'simple-homme',
    registeredAt: '2026-05-13T10:00:00Z',
  },
  {
    id: 'r2',
    tournamentId: 't1',
    playerId: 'p2',
    gameType: 'double-homme',
    registeredAt: '2026-05-13T10:01:00Z',
  },
  {
    id: 'r3',
    tournamentId: 't1',
    playerId: 'p3',
    gameType: 'double-homme',
    registeredAt: '2026-05-13T10:02:00Z',
  },
];

describe('RegistrationService', () => {
  let service: RegistrationService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { collectionData } = await import('@angular/fire/firestore');
    vi.mocked(collectionData).mockReturnValue(of(mockRegistrations) as any);

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

  // --- getRegistrations() ---

  it('getRegistrations() should return an Observable of registrations — AC: vue par type de jeu', () => {
    return new Promise<void>((resolve) => {
      service.getRegistrations('t1').subscribe((registrations) => {
        expect(Array.isArray(registrations)).toBe(true);
        resolve();
      });
    });
  });

  it('getRegistrations() should call collection with correct subcollection path — AC: sous-collection registrations', async () => {
    const { collection } = await import('@angular/fire/firestore');
    service.getRegistrations('t1');
    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      'tournaments',
      't1',
      'registrations'
    );
  });

  it('getRegistrations() with gameType filter should call where with gameType — AC: filtre par type de jeu', async () => {
    const { where } = await import('@angular/fire/firestore');
    service.getRegistrations('t1', 'double-homme');
    expect(where).toHaveBeenCalledWith('gameType', '==', 'double-homme');
  });

  it('getRegistrations() without gameType should not call where — AC: liste complète sans filtre', async () => {
    const { where } = await import('@angular/fire/firestore');
    service.getRegistrations('t1');
    expect(where).not.toHaveBeenCalled();
  });

  it('getRegistrations() should return Observable with registration data — AC: liste inscrits', () => {
    return new Promise<void>((resolve) => {
      service.getRegistrations('t1').subscribe((registrations) => {
        expect(registrations).toHaveLength(3);
        expect(registrations[0]).toHaveProperty('playerId');
        expect(registrations[0]).toHaveProperty('gameType');
        resolve();
      });
    });
  });

  // --- addRegistration() ---

  it('addRegistration() should call addDoc and return a Registration — AC: ajout manuel joueur', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const result = await service.addRegistration({
      tournamentId: 't1',
      playerId: 'p4',
      gameType: 'simple-femme',
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.id).toBe('generated-reg-id');
    expect(result.playerId).toBe('p4');
    expect(result.gameType).toBe('simple-femme');
    expect(result.tournamentId).toBe('t1');
  });

  it('addRegistration() should write tournamentId, playerId, gameType, registeredAt to Firestore — AC: ajout manuel', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.addRegistration({
      tournamentId: 't1',
      playerId: 'p5',
      gameType: 'double-mixte',
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tournamentId: 't1',
        playerId: 'p5',
        gameType: 'double-mixte',
        registeredAt: expect.any(String),
      })
    );
  });

  it('addRegistration() should use correct subcollection path — AC: stockage sous-collection', async () => {
    const { collection } = await import('@angular/fire/firestore');

    await service.addRegistration({
      tournamentId: 'tournament-xyz',
      playerId: 'p1',
      gameType: 'simple-homme',
    });

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      'tournaments',
      'tournament-xyz',
      'registrations'
    );
  });

  it('addRegistration() should stamp registeredAt as ISO string — AC: date inscription', async () => {
    const result = await service.addRegistration({
      tournamentId: 't1',
      playerId: 'p1',
      gameType: 'double-femme',
    });

    expect(result.registeredAt).toBeTruthy();
    expect(new Date(result.registeredAt).toISOString()).toBe(result.registeredAt);
  });

  // --- removeRegistration() ---

  it('removeRegistration() should call deleteDoc — AC: suppression manuelle joueur', async () => {
    const { deleteDoc } = await import('@angular/fire/firestore');

    await service.removeRegistration('t1', 'r1');

    expect(deleteDoc).toHaveBeenCalled();
  });

  it('removeRegistration() should call doc with correct path — AC: suppression par id', async () => {
    const { doc } = await import('@angular/fire/firestore');

    await service.removeRegistration('t1', 'r1');

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      'tournaments',
      't1',
      'registrations',
      'r1'
    );
  });
});
