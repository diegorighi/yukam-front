import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Signal to track current theme
  private readonly themeSignal = signal<Theme>(this.getInitialTheme());

  // Public readonly signal for components to consume
  readonly currentTheme = this.themeSignal.asReadonly();

  constructor() {
    // Effect to apply theme changes to DOM
    effect(() => {
      const theme = this.themeSignal();
      this.applyTheme(theme);
    });
  }

  /**
   * Gets the initial theme from localStorage or defaults to dark
   */
  private getInitialTheme(): Theme {
    // Check localStorage first
    const savedTheme = localStorage.getItem('yukam-theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    // Default to dark theme (mantém o estilo atual)
    return 'dark';
  }

  /**
   * Applies the theme to the document
   */
  private applyTheme(theme: Theme): void {
    console.log('🎨 Aplicando tema:', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('yukam-theme', theme);
    console.log('✅ Atributo data-theme definido:', document.documentElement.getAttribute('data-theme'));
  }

  /**
   * Toggles between light and dark theme
   */
  toggleTheme(): void {
    const currentTheme = this.themeSignal();
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    console.log('🔄 Toggle tema - Atual:', currentTheme, '→ Novo:', newTheme);
    this.themeSignal.set(newTheme);
  }

  /**
   * Sets a specific theme
   */
  setTheme(theme: Theme): void {
    this.themeSignal.set(theme);
  }

  /**
   * Returns true if current theme is dark
   */
  isDark(): boolean {
    return this.themeSignal() === 'dark';
  }
}
