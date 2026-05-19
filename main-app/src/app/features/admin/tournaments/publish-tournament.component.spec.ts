import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishTournamentComponent } from './publish-tournament.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { ActivatedRoute } from '@angular/router';

const mockTournamentService = {
  publishTournament: vi.fn(),
};

describe('PublishTournamentComponent', () => {
  let fixture: ComponentFixture<PublishTournamentComponent>;
  let component: PublishTournamentComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTournamentService.publishTournament.mockResolvedValue('test-uuid-token-1234');

    await TestBed.configureTestingModule({
      imports: [PublishTournamentComponent],
      providers: [
        { provide: TournamentService, useValue: mockTournamentService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'tournament-1' } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublishTournamentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  // --- Initial state ---

  it('should show "Publier le tournoi" button initially', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.textContent.trim()).toContain('Publier le tournoi');
  });

  it('should not show confirmation dialog initially', () => {
    expect(component.showConfirm()).toBe(false);
  });

  it('should not show participation link initially', () => {
    expect(component.participationLink()).toBe('');
  });

  // --- requestConfirm() ---

  it('requestConfirm should show confirm dialog — AC: dialog de confirmation', () => {
    component.requestConfirm();
    expect(component.showConfirm()).toBe(true);
  });

  it('requestConfirm should clear error', () => {
    component.error.set('some error');
    component.requestConfirm();
    expect(component.error()).toBeNull();
  });

  // --- cancel() ---

  it('cancel should hide confirm dialog', () => {
    component.showConfirm.set(true);
    component.cancel();
    expect(component.showConfirm()).toBe(false);
  });

  // --- confirm() — AC: Brouillon → Inscriptions ouvertes ---

  it('confirm should call publishTournament with the tournamentId — AC: publication tournoi', async () => {
    await component.confirm();
    expect(mockTournamentService.publishTournament).toHaveBeenCalledWith('tournament-1');
  });

  it('confirm should set participationLink after publish — AC: lien unique de participation', async () => {
    await component.confirm();
    expect(component.participationLink()).toContain('test-uuid-token-1234');
  });

  it('confirm should include /tournament/<token>/register in the link', async () => {
    await component.confirm();
    expect(component.participationLink()).toContain('/tournament/test-uuid-token-1234/register');
  });

  it('confirm should hide confirm dialog after success', async () => {
    component.showConfirm.set(true);
    await component.confirm();
    expect(component.showConfirm()).toBe(false);
  });

  it('confirm should set loading to true during publish, then false after', async () => {
    let loadingDuringCall = false;

    mockTournamentService.publishTournament.mockImplementation(async () => {
      loadingDuringCall = component.loading();
      return 'token-xyz';
    });

    await component.confirm();

    expect(loadingDuringCall).toBe(true);
    expect(component.loading()).toBe(false);
  });

  // --- Error handling ---

  it('confirm should set error on failure — AC: gestion erreur', async () => {
    mockTournamentService.publishTournament.mockRejectedValueOnce(new Error('Firestore error'));

    await component.confirm();

    expect(component.error()).not.toBeNull();
    expect(component.participationLink()).toBe('');
  });

  it('confirm should reset loading on failure', async () => {
    mockTournamentService.publishTournament.mockRejectedValueOnce(new Error('Network error'));

    await component.confirm();

    expect(component.loading()).toBe(false);
  });

  // --- AC: joueurs peuvent s'inscrire (lien contient origin + token) ---

  it('participationLink should use window.location.origin as base URL', async () => {
    await component.confirm();
    expect(component.participationLink()).toContain(window.location.origin);
  });
});
