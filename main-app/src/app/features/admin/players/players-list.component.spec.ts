import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { PlayersListComponent } from './players-list.component';
import { PlayerService } from '../../../core/services/player.service';
import { Player } from '../../../core/models/player.model';

const mockPlayers: Player[] = [
  { id: 'p1', firstName: 'Alice', lastName: 'Dupont', gender: 'femme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p2', firstName: 'Bob', lastName: 'Martin', gender: 'homme', active: true, createdAt: '2026-05-01T00:00:00Z' },
  { id: 'p3', firstName: 'Claire', lastName: 'Arnaud', gender: 'femme', active: false, createdAt: '2026-05-01T00:00:00Z' },
];

describe('PlayersListComponent', () => {
  let component: PlayersListComponent;
  let mockPlayerService: { getPlayers: ReturnType<typeof vi.fn>; deactivatePlayer: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockPlayerService = {
      getPlayers: vi.fn().mockReturnValue(of(mockPlayers)),
      deactivatePlayer: vi.fn().mockResolvedValue(undefined),
    };
    mockRouter = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [PlayersListComponent],
      providers: [
        { provide: PlayerService, useValue: mockPlayerService },
        { provide: Router, useValue: mockRouter },
      ],
    });

    const fixture = TestBed.createComponent(PlayersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('should load and display all players on init — AC: liste membres', () => {
    expect(mockPlayerService.getPlayers).toHaveBeenCalled();
    expect(component.filteredSortedPlayers().length).toBe(3);
  });

  it('should display player nom, prénom, genre — AC: liste nom/prénom/genre', () => {
    const players = component.filteredSortedPlayers();
    const alice = players.find((p) => p.id === 'p1');
    expect(alice?.firstName).toBe('Alice');
    expect(alice?.lastName).toBe('Dupont');
    expect(alice?.gender).toBe('femme');
  });

  it('should filter by gender femme — AC: filtrable par genre', () => {
    component.genderFilter.set('femme');
    const filtered = component.filteredSortedPlayers();
    expect(filtered.every((p) => p.gender === 'femme')).toBe(true);
    expect(filtered.length).toBe(2);
  });

  it('should filter by gender homme — AC: filtrable par genre', () => {
    component.genderFilter.set('homme');
    const filtered = component.filteredSortedPlayers();
    expect(filtered.every((p) => p.gender === 'homme')).toBe(true);
    expect(filtered.length).toBe(1);
  });

  it('should show all when gender filter is empty — AC: filtrable par genre', () => {
    component.genderFilter.set('');
    expect(component.filteredSortedPlayers().length).toBe(3);
  });

  it('should sort by lastName asc by default — AC: triable par nom', () => {
    component.sortDirection.set('asc');
    const players = component.filteredSortedPlayers();
    expect(players[0].lastName).toBe('Arnaud');
    expect(players[1].lastName).toBe('Dupont');
    expect(players[2].lastName).toBe('Martin');
  });

  it('should sort by lastName desc when direction is desc — AC: triable par nom', () => {
    component.sortDirection.set('desc');
    const players = component.filteredSortedPlayers();
    expect(players[0].lastName).toBe('Martin');
    expect(players[1].lastName).toBe('Dupont');
    expect(players[2].lastName).toBe('Arnaud');
  });

  it('viewProfile() should navigate to player detail — AC: accès profil détaillé', () => {
    component.viewProfile('p1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/players', 'p1']);
  });

  it('deactivate() should call playerService.deactivatePlayer — AC: désactivation profil', async () => {
    await component.deactivate('p2');
    expect(mockPlayerService.deactivatePlayer).toHaveBeenCalledWith('p2');
  });

  it('should show active and inactive players with correct active state — AC: désactivation profil', () => {
    const players = component.filteredSortedPlayers();
    const active = players.filter((p) => p.active);
    const inactive = players.filter((p) => !p.active);
    expect(active.length).toBe(2);
    expect(inactive.length).toBe(1);
  });
});
