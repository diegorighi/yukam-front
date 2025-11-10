import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { staffGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard, staffGuard] // Requer autenticação + role de funcionário (ADMIN, ANALISTA, FUNCIONARIO)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
