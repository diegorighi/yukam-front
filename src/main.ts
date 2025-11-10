import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { isDevMode } from '@angular/core';

/**
 * Detecção de Hot Reload em Development
 * Previne problemas de cache de sessão durante desenvolvimento
 *
 * Funcionalidade:
 * - Detecta reloads muito rápidos (< 5 segundos)
 * - Limpa localStorage automaticamente em hot reload
 * - Apenas ativo em modo development
 */
if (isDevMode()) {
  const DEV_RELOAD_KEY = '_dev_last_reload';
  const HOT_RELOAD_THRESHOLD = 5000; // 5 segundos

  const lastReload = localStorage.getItem(DEV_RELOAD_KEY);
  const now = Date.now();

  if (lastReload) {
    const timeSinceLastReload = now - parseInt(lastReload, 10);

    if (timeSinceLastReload < HOT_RELOAD_THRESHOLD) {
      console.warn(
        '[Dev Mode] Hot reload detectado (' + timeSinceLastReload + 'ms). ' +
        'Limpando sessão de autenticação para evitar bugs de cache...'
      );
      localStorage.removeItem('yukam_auth_user');
    }
  }

  localStorage.setItem(DEV_RELOAD_KEY, now.toString());
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
