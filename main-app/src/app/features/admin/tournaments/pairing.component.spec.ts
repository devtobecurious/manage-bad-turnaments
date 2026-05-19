import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { PairingComponent } from './pairing.component';
import { PairingService } from '../../../core/services/pairing.service';
import { RegistrationService } from '../../../core/services/registration.service';
import { PlayerService } from '../../../core/services/player.service';
import { ActivatedRoute } from '@angular/router';
import { Pair } from '../../../core/models/pairing.model';

const mockPairs: Pair[] = [
  { id: 'pair-1', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: false },
  { id: 'pair-2', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p3', player2Id: 'p4', locked: false },
];

const mockLockedPairs: Pair[] = [
  { id: 'pair-1', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: true },
  { id: 'pair-2', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p3', player2Id: 'p4', locked: true },
];

const mockPlayers = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'femme', createdAt: '2026-01-01', active: true },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'homme', createdAt: '2026-01-01', active: true },
  { id: 'p3', firstName: 'Charlie', lastName: 'Leroy', gender: 'homme', createdAt: '2026-01-01', active: true },
  { id: 'p4', firstName: 'Diana', lastName: 'Moreau', gender: 'femme', createdAt: '2026-01-01', active: true },
];

const mockPairingService = {
  generatePairs: vi.fn(),
  getPairs: vi.fn().mockReturnValue(of([])),
  savePairs: vi.fn().mockResolvedValue(undefined),
  lockPairs: vi.fn().mockResolvedValue(undefined),
  resetPairs: vi.fn().mockResolvedValue(undefined),
  updatePair: vi.fn().mockResolvedValue(undefined),
};

const mockRegistrationService = {
  getRegistrations: vi.fn().mockReturnValue(of([])),
  getOpenTournaments: vi.fn().mockReturnValue(of([])),
};

const mockPlayerService = {
  getPlayers: vi.fn().mockReturnValue(of(mockPlayers)),
};

describe('PairingComponent', () => {
  let fixture: ComponentFixture<PairingComponent>;
  let component: PairingComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPairingService.getPairs.mockReturnValue(of([]));
    mockRegistrationService.getRegistrations.mockReturnValue(of([]));
    mockPairingService.generatePairs.mockReturnValue(mockPairs);

    await TestBed.configureTestingModule({
      imports: [PairingComponent],
      providers: [
        { provide: PairingService, useValue: mockPairingService },
        { provide: RegistrationService, useValue: mockRegistrationService },
        { provide: PlayerService, useValue: mockPlayerService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 't1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PairingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created — AC: composant créé', () => {
    expect(component).toBeTruthy();
  });

  // --- Tabs ---

  it('should display tabs for double game types only — AC: onglets double/mixte', () => {
    const native: HTMLElement = fixture.nativeElement;
    const buttons = native.querySelectorAll('button');
    const tabTexts = Array.from(buttons).map((b) => b.textContent?.trim() ?? '');
    expect(tabTexts.some((t) => t.includes('Double Homme'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Double Femme'))).toBe(true);
    expect(tabTexts.some((t) => t.includes('Double Mixte'))).toBe(true);
  });

  it('selectTab() should switch activeTab — AC: navigation onglets', () => {
    component.selectTab('double-femme');
    expect(component.activeTab()).toBe('double-femme');
  });

  it('selectTab() should change active tab to double-mixte — AC: navigation onglets', () => {
    component.selectTab('double-mixte');
    expect(component.activeTab()).toBe('double-mixte');
  });

  // --- generatePairs() ---

  it('onGeneratePairs() should call pairingService.generatePairs — AC: appariement aléatoire', () => {
    component['registrationPlayerIds'].set({
      'simple-homme': [],
      'simple-femme': [],
      'double-homme': ['p1', 'p2', 'p3', 'p4'],
      'double-femme': [],
      'double-mixte': [],
    });

    component.onGeneratePairs();

    expect(mockPairingService.generatePairs).toHaveBeenCalledWith('t1', 'double-homme', ['p1', 'p2', 'p3', 'p4']);
  });

  it('onGeneratePairs() should set inMemoryPairs on success — AC: affichage des paires', () => {
    mockPairingService.generatePairs.mockReturnValue(mockPairs);
    component['registrationPlayerIds'].set({
      'simple-homme': [],
      'simple-femme': [],
      'double-homme': ['p1', 'p2', 'p3', 'p4'],
      'double-femme': [],
      'double-mixte': [],
    });

    component.onGeneratePairs();

    expect(component.inMemoryPairs()).toEqual(mockPairs);
  });

  it('onGeneratePairs() should set oddCountError on odd player count — AC: blocage si impair', () => {
    mockPairingService.generatePairs.mockImplementation(() => {
      throw new Error("Nombre impair d'inscrits (3) pour double-homme.");
    });

    component['registrationPlayerIds'].set({
      'simple-homme': [],
      'simple-femme': [],
      'double-homme': ['p1', 'p2', 'p3'],
      'double-femme': [],
      'double-mixte': [],
    });

    component.onGeneratePairs();

    expect(component.oddCountError()).toBeTruthy();
    expect(component.inMemoryPairs()).toHaveLength(0);
  });

  it('onGeneratePairs() should not set inMemoryPairs if odd — AC: blocage si impair', () => {
    mockPairingService.generatePairs.mockImplementation(() => {
      throw new Error("Nombre impair");
    });

    component.onGeneratePairs();

    expect(component.inMemoryPairs()).toHaveLength(0);
  });

  // --- arePairsLocked() ---

  it('arePairsLocked() should return false when savedPairs is empty — AC: paires non figées', () => {
    component['savedPairs'].set([]);
    expect(component.arePairsLocked()).toBe(false);
  });

  it('arePairsLocked() should return true when all saved pairs are locked — AC: paires figées', () => {
    component['savedPairs'].set(mockLockedPairs);
    expect(component.arePairsLocked()).toBe(true);
  });

  it('arePairsLocked() should return false when some pairs are not locked — AC: paires non figées', () => {
    component['savedPairs'].set(mockPairs);
    expect(component.arePairsLocked()).toBe(false);
  });

  // --- displayedPairs() ---

  it('displayedPairs() should show in-memory pairs when present — AC: affichage paires en mémoire', () => {
    component.inMemoryPairs.set(mockPairs);
    const displayed = component.displayedPairs();
    expect(displayed).toHaveLength(2);
    expect(displayed[0].player1Id).toBe('p1');
  });

  it('displayedPairs() should fall back to saved pairs when no in-memory pairs — AC: fallback paires persistées', () => {
    component.inMemoryPairs.set([]);
    component['savedPairs'].set(mockPairs);
    const displayed = component.displayedPairs();
    expect(displayed).toHaveLength(2);
  });

  it('displayedPairs() should add index to each pair — AC: affichage numérotation', () => {
    component.inMemoryPairs.set(mockPairs);
    const displayed = component.displayedPairs();
    expect(displayed[0].index).toBe(0);
    expect(displayed[1].index).toBe(1);
  });

  // --- savePairs() ---

  it('onSavePairs() should call pairingService.savePairs — AC: enregistrement paires', async () => {
    component.inMemoryPairs.set(mockPairs);
    await component.onSavePairs();
    expect(mockPairingService.savePairs).toHaveBeenCalledWith('t1', 'double-homme', mockPairs);
  });

  it('onSavePairs() should clear inMemoryPairs on success — AC: transition mémoire → persisté', async () => {
    component.inMemoryPairs.set(mockPairs);
    await component.onSavePairs();
    expect(component.inMemoryPairs()).toHaveLength(0);
  });

  it('onSavePairs() should set generalError on failure — AC: gestion erreur', async () => {
    mockPairingService.savePairs.mockRejectedValueOnce(new Error('Firestore error'));
    component.inMemoryPairs.set(mockPairs);
    await component.onSavePairs();
    expect(component.generalError()).toBeTruthy();
  });

  // --- lockPairs() ---

  it('onLockPairs() should call pairingService.lockPairs — AC: validation et figement', async () => {
    component.inMemoryPairs.set([]);
    await component.onLockPairs();
    expect(mockPairingService.lockPairs).toHaveBeenCalledWith('t1', 'double-homme');
  });

  it('onLockPairs() should save in-memory pairs before locking — AC: validation paires non encore sauvegardées', async () => {
    component.inMemoryPairs.set(mockPairs);
    await component.onLockPairs();
    expect(mockPairingService.savePairs).toHaveBeenCalled();
    expect(mockPairingService.lockPairs).toHaveBeenCalled();
  });

  it('onLockPairs() should set generalError on failure — AC: gestion erreur verrouillage', async () => {
    mockPairingService.lockPairs.mockRejectedValueOnce(new Error('Firestore error'));
    component.inMemoryPairs.set([]);
    await component.onLockPairs();
    expect(component.generalError()).toBeTruthy();
  });

  // --- startEdit / cancelEdit / onConfirmEdit ---

  it('startEdit() should set editingPairIndex and editPlayer1/2 — AC: modification manuelle', () => {
    const pair = { ...mockPairs[0], index: 0 };
    component.startEdit(pair);
    expect(component.editingPairIndex()).toBe(0);
    expect(component.editPlayer1()).toBe('p1');
    expect(component.editPlayer2()).toBe('p2');
  });

  it('cancelEdit() should reset editingPairIndex — AC: annulation modification', () => {
    component.editingPairIndex.set(1);
    component.cancelEdit();
    expect(component.editingPairIndex()).toBe(-1);
  });

  it('onConfirmEdit() should set error if same player selected twice — AC: validation éditeur', async () => {
    component.inMemoryPairs.set(mockPairs);
    component.editPlayer1.set('p1');
    component.editPlayer2.set('p1');
    await component.onConfirmEdit(0);
    expect(component.generalError()).toBeTruthy();
  });

  it('onConfirmEdit() should update in-memory pair for draft pairs — AC: modification paire en mémoire', async () => {
    component.inMemoryPairs.set([
      { id: '', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: false },
    ]);
    component.editPlayer1.set('p3');
    component.editPlayer2.set('p4');
    await component.onConfirmEdit(0);
    expect(component.inMemoryPairs()[0].player1Id).toBe('p3');
    expect(component.inMemoryPairs()[0].player2Id).toBe('p4');
  });

  it('onConfirmEdit() should call updatePair for persisted pairs — AC: modification paire persistée', async () => {
    component.inMemoryPairs.set([]);
    component['savedPairs'].set(mockPairs);
    component.editPlayer1.set('p3');
    component.editPlayer2.set('p4');
    await component.onConfirmEdit(0);
    expect(mockPairingService.updatePair).toHaveBeenCalledWith('t1', 'pair-1', 'p3', 'p4', false);
  });

  it('onConfirmEdit() should reset editingPairIndex after success — AC: fin modification', async () => {
    component.inMemoryPairs.set([
      { id: '', tournamentId: 't1', gameType: 'double-homme', player1Id: 'p1', player2Id: 'p2', locked: false },
    ]);
    component.editPlayer1.set('p3');
    component.editPlayer2.set('p4');
    await component.onConfirmEdit(0);
    expect(component.editingPairIndex()).toBe(-1);
  });

  // --- playerName() ---

  it('playerName() should return formatted name for known player — AC: affichage nom', () => {
    const name = component.playerName('p1');
    expect(name).toBe('Dupont Alice');
  });

  it('playerName() should return playerId for unknown player — AC: fallback ID', () => {
    const name = component.playerName('unknown-id');
    expect(name).toBe('unknown-id');
  });
});
