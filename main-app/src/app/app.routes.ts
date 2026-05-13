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
    ],
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
