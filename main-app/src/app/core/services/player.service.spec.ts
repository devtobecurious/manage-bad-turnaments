import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerService } from './player.service';

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue({ path: 'players' }),
  addDoc: vi.fn().mockResolvedValue({ id: 'generated-player-id' }),
  doc: vi.fn().mockReturnValue({ path: 'players/player-1' }),
  getDoc: vi.fn().mockResolvedValue({
    exists: () => true,
    id: 'player-1',
    data: () => ({
      firstName: 'Jean',
      lastName: 'Dupont',
      gender: 'homme',
      createdAt: '2026-05-13T12:00:00Z',
    }),
  }),
}));

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { Firestore } = await import('@angular/fire/firestore');

    TestBed.configureTestingModule({
      providers: [
        PlayerService,
        { provide: Firestore, useValue: {} },
      ],
    });

    service = TestBed.inject(PlayerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // AC3: Un profil est créé avec un identifiant unique
  it('registerPlayer should create a player doc in Firestore and return a Player with id — AC: profil créé avec identifiant unique', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    const result = await service.registerPlayer({
      firstName: 'Jean',
      lastName: 'Dupont',
      gender: 'homme',
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result.id).toBe('generated-player-id');
    expect(result.firstName).toBe('Jean');
    expect(result.lastName).toBe('Dupont');
    expect(result.gender).toBe('homme');
    expect(result.createdAt).toBeTruthy();
  });

  // AC2: Le joueur remplit prénom, nom, genre
  it('registerPlayer should save firstName, lastName, and gender — AC: prénom, nom, genre', async () => {
    const { addDoc } = await import('@angular/fire/firestore');

    await service.registerPlayer({
      firstName: 'Marie',
      lastName: 'Martin',
      gender: 'femme',
    });

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        firstName: 'Marie',
        lastName: 'Martin',
        gender: 'femme',
      })
    );
  });

  it('registerPlayer should accept gender "homme" — AC: genre homme/femme', async () => {
    const result = await service.registerPlayer({
      firstName: 'Pierre',
      lastName: 'Durand',
      gender: 'homme',
    });
    expect(result.gender).toBe('homme');
  });

  it('registerPlayer should accept gender "femme" — AC: genre homme/femme', async () => {
    const { addDoc } = await import('@angular/fire/firestore');
    vi.mocked(addDoc).mockResolvedValueOnce({ id: 'player-femme-id' } as never);

    const result = await service.registerPlayer({
      firstName: 'Claire',
      lastName: 'Petit',
      gender: 'femme',
    });
    expect(result.gender).toBe('femme');
  });

  it('getPlayer should return null when player does not exist', async () => {
    const { getDoc } = await import('@angular/fire/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);

    const result = await service.getPlayer('unknown-id');
    expect(result).toBeNull();
  });

  it('getPlayer should return player data when document exists', async () => {
    const result = await service.getPlayer('player-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('player-1');
    expect(result?.firstName).toBe('Jean');
  });

  // AC4: Le joueur reçoit son lien personnel
  it('registerPlayer should return id that can be used to form a personal link — AC: lien personnel', async () => {
    const player = await service.registerPlayer({
      firstName: 'Test',
      lastName: 'User',
      gender: 'homme',
    });

    // The personal link is /player/:id
    expect(player.id).toBeDefined();
    expect(typeof player.id).toBe('string');
    expect(player.id.length).toBeGreaterThan(0);
  });
});
