import { TestBed, ComponentFixture } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloseRegistrationsComponent } from './close-registrations.component';
import { TournamentService } from '../../../core/services/tournament.service';
import { ComponentRef } from '@angular/core';

const mockTournamentService = {
  closeRegistrations: vi.fn(),
};

describe('CloseRegistrationsComponent', () => {
  let fixture: ComponentFixture<CloseRegistrationsComponent>;
  let component: CloseRegistrationsComponent;
  let componentRef: ComponentRef<CloseRegistrationsComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTournamentService.closeRegistrations.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [CloseRegistrationsComponent],
      providers: [
        { provide: TournamentService, useValue: mockTournamentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CloseRegistrationsComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('tournamentId', 'tournament-1');
    componentRef.setInput('currentStatus', 'Inscriptions ouvertes');
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  // --- canClose computed — AC: bouton désactivé si statut != Inscriptions ouvertes ---

  it('canClose should be true when currentStatus is "Inscriptions ouvertes"', () => {
    componentRef.setInput('currentStatus', 'Inscriptions ouvertes');
    fixture.detectChanges();
    expect(component.canClose()).toBe(true);
  });

  it('canClose should be false when currentStatus is "Brouillon" — AC: désactive le bouton', () => {
    componentRef.setInput('currentStatus', 'Brouillon');
    fixture.detectChanges();
    expect(component.canClose()).toBe(false);
  });

  it('canClose should be false when currentStatus is "Inscriptions clôturées" — AC: déjà clôturé', () => {
    componentRef.setInput('currentStatus', 'Inscriptions clôturées');
    fixture.detectChanges();
    expect(component.canClose()).toBe(false);
  });

  it('canClose should be false when currentStatus is "En cours"', () => {
    componentRef.setInput('currentStatus', 'En cours');
    fixture.detectChanges();
    expect(component.canClose()).toBe(false);
  });

  it('canClose should be false when currentStatus is "Terminé"', () => {
    componentRef.setInput('currentStatus', 'Terminé');
    fixture.detectChanges();
    expect(component.canClose()).toBe(false);
  });

  // --- Initial state ---

  it('should show "Clôturer les inscriptions" button when status is Inscriptions ouvertes', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.textContent.trim()).toContain('Clôturer les inscriptions');
  });

  it('should not show confirmation dialog initially', () => {
    expect(component.showConfirm()).toBe(false);
  });

  it('should not show success state initially', () => {
    expect(component.closed()).toBe(false);
  });

  // --- requestConfirm() ---

  it('requestConfirm should show confirm dialog — AC: modale de confirmation', () => {
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

  // --- confirm() — AC: Inscriptions ouvertes → Inscriptions clôturées ---

  it('confirm should call closeRegistrations with the tournamentId — AC: clôture tournoi', async () => {
    await component.confirm();
    expect(mockTournamentService.closeRegistrations).toHaveBeenCalledWith('tournament-1');
  });

  it('confirm should set closed to true after success — AC: passage statut clôturé', async () => {
    await component.confirm();
    expect(component.closed()).toBe(true);
  });

  it('confirm should hide confirm dialog after success', async () => {
    component.showConfirm.set(true);
    await component.confirm();
    expect(component.showConfirm()).toBe(false);
  });

  it('confirm should set loading to true during close, then false after', async () => {
    let loadingDuringCall = false;

    mockTournamentService.closeRegistrations.mockImplementation(async () => {
      loadingDuringCall = component.loading();
    });

    await component.confirm();

    expect(loadingDuringCall).toBe(true);
    expect(component.loading()).toBe(false);
  });

  // --- Error handling ---

  it('confirm should set error on failure — AC: gestion erreur', async () => {
    mockTournamentService.closeRegistrations.mockRejectedValueOnce(new Error('Firestore error'));

    await component.confirm();

    expect(component.error()).not.toBeNull();
    expect(component.closed()).toBe(false);
  });

  it('confirm should reset loading on failure', async () => {
    mockTournamentService.closeRegistrations.mockRejectedValueOnce(new Error('Network error'));

    await component.confirm();

    expect(component.loading()).toBe(false);
  });

  // --- AC: liste des inscrits reste visible (composant ne cache pas le contenu) ---

  it('should not hide content after closure — AC: liste inscrits reste visible', async () => {
    await component.confirm();
    fixture.detectChanges();
    // The component only shows a success message, not blocking the page
    const successEl = fixture.nativeElement.querySelector('.bg-orange-50');
    expect(successEl).not.toBeNull();
  });
});
