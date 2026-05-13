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
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [adminGuard],
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
