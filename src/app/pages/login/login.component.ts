import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/user.model';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Login Page Component
 *
 * Página de autenticação com formulário reativo validado
 * Integração com AuthService para autenticação via user-core microservice
 * Suporte a tema claro/escuro, design responsivo mobile-first
 *
 * Funcionalidades:
 * - Validação de formulário (login min 3 chars, senha min 6 chars)
 * - Toggle show/hide senha
 * - Estados de loading durante submit
 * - Tratamento de erros (401, network, validação)
 * - Redirect para /dashboard após login bem-sucedido
 * - Acessibilidade (WCAG 2.1 AA)
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  // Dependency injection usando inject()
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  // URL para redirecionar após login bem-sucedido
  private returnUrl: string = '/dashboard';

  // Reactive state usando signals
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  showPassword = signal<boolean>(false);

  // Reactive form
  loginForm: FormGroup;

  constructor() {
    // Inicializar formulário com validações
    this.loginForm = this.fb.group({
      login: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Capturar returnUrl da query string (se houver)
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    // Redirect se já estiver autenticado E tiver roles válidas
    if (this.authService.isAuthenticated() && this.authService.getUserRoles().length > 0) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  /**
   * Toggle visibilidade da senha
   */
  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  /**
   * Getters para facilitar acesso aos controles do formulário no template
   */
  get loginControl() {
    return this.loginForm.get('login');
  }

  get passwordControl() {
    return this.loginForm.get('password');
  }

  /**
   * Verifica se um campo específico tem erro e foi tocado
   */
  hasError(fieldName: string, errorType: string): boolean {
    const control = this.loginForm.get(fieldName);
    return !!(control?.hasError(errorType) && (control?.dirty || control?.touched));
  }

  /**
   * Submit do formulário de login
   * Realiza autenticação e redireciona para dashboard em caso de sucesso
   */
  onSubmit(): void {
    // Limpar erro anterior
    this.errorMessage.set('');

    // Validar formulário
    if (this.loginForm.invalid) {
      // Marcar todos os campos como touched para mostrar erros
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
      return;
    }

    // Ativar loading
    this.isLoading.set(true);

    // Preparar credenciais
    const credentials: LoginRequest = {
      login: this.loginForm.value.login.trim(),
      password: this.loginForm.value.password
    };

    // Realizar login
    this.authService.login(credentials).subscribe({
      next: (user) => {
        console.log('Login bem-sucedido:', user);

        // Desativar loading
        this.isLoading.set(false);

        // Redirecionar para URL original (ou dashboard por padrão)
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Erro no login:', error);

        // Desativar loading
        this.isLoading.set(false);

        // Tratar diferentes tipos de erro
        if (error.status === 401) {
          this.errorMessage.set('Credenciais inválidas. Verifique seu login e senha.');
        } else if (error.status === 0) {
          this.errorMessage.set('Erro de conexão. Verifique sua internet e tente novamente.');
        } else if (error.status === 500) {
          this.errorMessage.set('Erro no servidor. Tente novamente mais tarde.');
        } else {
          this.errorMessage.set(
            error.error?.message ||
            'Erro ao realizar login. Tente novamente.'
          );
        }

        // Resetar senha para segurança
        this.loginForm.patchValue({ password: '' });
      }
    });
  }

  /**
   * Limpar mensagem de erro quando usuário começar a digitar
   */
  onInputChange(): void {
    if (this.errorMessage()) {
      this.errorMessage.set('');
    }
  }
}
