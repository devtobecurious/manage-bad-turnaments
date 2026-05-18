import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayerService } from './player.service';
import { Player } from '../models/player.model';

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
      active: true,
    }),
  }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockImplementation((ref) => ref),
  orderBy: vi.fn().mockReturnValue({}),
  onSnapshot: vi.fn(),
}));

const mockPlayers: Player[] = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'femme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'homme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p3', firstName: 'Claire', lastName: 'Bernard', gender: 'femme', active: false, createdAt: '2026-05-01T00:00:00Z' },
];

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { onSnapshot } = await import('@angular/fire/firestore');
    vi.mocked(onSnapshot as any).mockImplementation((_q: unknown, successCb: Function) => {
      successCb({ docs: mockPlayers.map((d: any) => ({ id: d.id, data: () => d })) });
      return () => {};
    });

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

  // --- getPlayers() tests (US-004) ---

  it('getPlayers() should return an Observable of players — AC: liste membres', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        expect(players).toHaveLength(3);
        resolve();
      });
    });
  });

  it('getPlayers() should return players with nom, prénom, genre — AC: liste nom/prénom/genre', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        const player = players[0];
        expect(player).toHaveProperty('firstName');
        expect(player).toHaveProperty('lastName');
        expect(player).toHaveProperty('gender');
        resolve();
      });
    });
  });

  it('getPlayers() should return players with active flag — AC: désactivation profil', () => {
    return new Promise<void>((resolve) => {
      service.getPlayers().subscribe((players) => {
        const active = players.find((p) => p.id === 'p1');
        const inactive = players.find((p) => p.id === 'p3');
        expect(active?.active).toBe(true);
        expect(inactive?.active).toBe(false);
        resolve();
      });
    });
  });

  // --- deactivatePlayer() tests (US-004) ---

  it('deactivatePlayer() should call updateDoc with active: false — AC: désactivation profil', async () => {
    const { updateDoc } = await import('@angular/fire/firestore');
    await service.deactivatePlayer('player-1');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { active: false }
    );
  });

  it('deactivatePlayer() should call doc with correct player ID — AC: désactivation profil', async () => {
    const { doc } = await import('@angular/fire/firestore');
    await service.deactivatePlayer('player-1');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'players', 'player-1');
  });

  // --- registerPlayer() tests (US-003) ---

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

  // --- getPlayer() tests (US-003) ---

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

  it('registerPlayer should return id that can be used to form a personal link — AC: lien personnel', async () => {
    const player = await service.registerPlayer({
      firstName: 'Test',
      lastName: 'User',
      gender: 'homme',
    });

    expect(player.id).toBeDefined();
    expect(typeof player.id).toBe('string');
    expect(player.id.length).toBeGreaterThan(0);
  });
});
