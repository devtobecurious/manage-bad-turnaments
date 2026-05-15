import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/admin.component').then((m) => m.AdminComponent),
      },
      {
        // Admin: add a player manually (US-002)
        path: 'players/new',
        loadComponent: () =>
          import('./features/admin/players/player-form.component').then(
            (m) => m.PlayerFormComponent
          ),
      },
      {
        path: 'players',
        loadComponent: () =>
          import('./features/admin/players/players-list.component').then(
            (m) => m.PlayersListComponent
          ),
      },
      {
        path: 'players/:id',
        loadComponent: () =>
          import('./features/admin/players/player-detail.component').then(
            (m) => m.PlayerDetailComponent
          ),
      },
      {
        // Admin: create a new tournament (US-005)
        path: 'tournaments/new',
        loadComponent: () =>
          import('./features/admin/tournaments/create-tournament.component').then(
            (m) => m.CreateTournamentComponent
          ),
      },
      {
        // Admin: configure pool format (US-006)
        path: 'tournaments/:id/pool-config',
        loadComponent: () =>
          import('./features/admin/tournaments/pool-config.component').then(
            (m) => m.PoolConfigComponent
          ),
      },
      {
        // Admin: publish a tournament (US-007)
        path: 'tournaments/:id/publish',
        loadComponent: () =>
          import('./features/admin/tournaments/publish-tournament.component').then(
            (m) => m.PublishTournamentComponent
          ),
      },
      {
        // Admin: manage registrations by game type (US-009)
        path: 'tournaments/:id/registrations',
        loadComponent: () =>
          import('./features/admin/tournaments/registrations.component').then(
            (m) => m.RegistrationsComponent
          ),
      },
      {
        // Admin: close registrations for a tournament (US-010)
        path: 'tournaments/:id/close',
        loadComponent: () =>
          import('./features/admin/tournaments/close-registrations.component').then(
            (m) => m.CloseRegistrationsComponent
          ),
      },
      {
        // Admin: form random pairs for doubles/mixte (US-011)
        path: 'tournaments/:id/pairing',
        loadComponent: () =>
          import('./features/admin/tournaments/pairing.component').then(
            (m) => m.PairingComponent
          ),
      },
      {
        // Admin: draw and validate pools (US-012)
        path: 'tournaments/:id/pool-draw',
        loadComponent: () =>
          import('./features/admin/tournaments/pool-draw.component').then(
            (m) => m.PoolDrawComponent
          ),
      },
      {
        // Admin: match schedule per pool (US-013)
        path: 'tournaments/:tournamentId/pools/:poolId/matches',
        loadComponent: () =>
          import('./features/admin/tournaments/match-schedule.component').then(
            (m) => m.MatchScheduleComponent
          ),
      },
    ],
  },
  {
    // Public route: player registration via invite token (AC1, AC2, AC3, AC4)
    path: 'register/:token',
    loadComponent: () =>
      import('./features/players/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    // Public route: player personal profile link (AC4)
    path: 'player/:id',
    loadComponent: () =>
      import('./features/players/profile/profile.component').then((m) => m.PlayerProfileComponent),
  },
  {
    // Player: register/unregister for open tournaments (US-008)
    path: 'player/:id/tournaments',
    loadComponent: () =>
      import('./features/players/tournaments/player-tournaments.component').then(
        (m) => m.PlayerTournamentsComponent
      ),
  },
  {
    // Player: consult pool standings and results (US-016)
    path: 'player/:playerId/tournaments/:tournamentId/pools/:poolId',
    loadComponent: () =>
      import('./features/players/tournaments/pool-standings.component').then(
        (m) => m.PoolStandingsComponent
      ),
  },
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
