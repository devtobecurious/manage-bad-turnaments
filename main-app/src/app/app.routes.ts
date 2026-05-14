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
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
