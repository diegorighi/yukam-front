import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { UserResponse, LoginRequest } from '../models/user.model';

/**
 * Authentication Service
 * Gerencia autenticação, autorização e controle de acesso baseado em roles
 *
 * Integração com user-core (porta 8182 via proxy /api)
 * Endpoint: POST /api/auth/login
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly baseUrl = '/api/auth';
  private readonly STORAGE_KEY = 'yukam_auth_user';

  // Signal para gerenciar estado de autenticação de forma reativa
  currentUser = signal<UserResponse | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Carregar usuário do localStorage ao inicializar o serviço
    this.loadUserFromStorage();
  }

  /**
   * Realiza login do usuário
   * Endpoint: POST /api/auth/login
   *
   * @param credentials LoginRequest com login e password
   * @returns Observable<UserResponse> com dados do usuário e suas roles
   */
  login(credentials: LoginRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/login`, credentials).pipe(
      tap(user => {
        // Salvar usuário no signal e localStorage
        this.currentUser.set(user);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      }),
      catchError(error => {
        console.error('Login falhou:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Realiza logout do usuário
   * Limpa dados de autenticação e redireciona para login
   */
  logout(): void {
    this.currentUser.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  /**
   * Verifica se o usuário está autenticado
   * @returns boolean - true se usuário está logado
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Verifica se o usuário possui uma role específica
   * @param role Nome da role (ex: "ROLE_ADMIN")
   * @returns boolean - true se usuário tem a role
   */
  hasRole(role: string): boolean {
    const user = this.currentUser();
    if (!user || !user.roles) return false;
    return user.roles.includes(role);
  }

  /**
   * Verifica se o usuário possui QUALQUER uma das roles fornecidas
   * @param roles Array de roles (ex: ["ROLE_ADMIN", "ROLE_ANALISTA"])
   * @returns boolean - true se usuário tem pelo menos uma das roles
   */
  hasAnyRole(roles: string[]): boolean {
    const user = this.currentUser();
    if (!user || !user.roles) return false;
    return roles.some(role => user.roles.includes(role));
  }

  /**
   * Verifica se o usuário possui TODAS as roles fornecidas
   * @param roles Array de roles
   * @returns boolean - true se usuário tem todas as roles
   */
  hasAllRoles(roles: string[]): boolean {
    const user = this.currentUser();
    if (!user || !user.roles) return false;
    return roles.every(role => user.roles.includes(role));
  }

  /**
   * Retorna as roles do usuário atual
   * @returns string[] - Array de roles ou array vazio se não autenticado
   */
  getUserRoles(): string[] {
    return this.currentUser()?.roles ?? [];
  }

  /**
   * Retorna o usuário atual
   * @returns UserResponse | null
   */
  getCurrentUser(): UserResponse | null {
    return this.currentUser();
  }

  /**
   * Carrega dados do usuário do localStorage
   * Chamado automaticamente ao inicializar o serviço
   */
  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem(this.STORAGE_KEY);
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as UserResponse;

        // Validar dados essenciais antes de carregar
        if (user && user.publicId && user.login && Array.isArray(user.roles) && user.roles.length > 0) {
          this.currentUser.set(user);
        } else {
          console.warn('Dados de usuário inválidos no localStorage. Limpando...');
          localStorage.removeItem(this.STORAGE_KEY);
        }
      } catch (error) {
        console.error('Erro ao carregar usuário do localStorage:', error);
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  /**
   * Verifica permissões baseadas em roles
   * Útil para renderização condicional de componentes
   */
  canAccess = {
    /**
     * Dashboard completo - Todas as roles exceto ROLE_CLIENTE podem acessar
     */
    fullDashboard: (): boolean => {
      return this.hasAnyRole(['ROLE_ADMIN', 'ROLE_ANALISTA', 'ROLE_FUNCIONARIO']);
    },

    /**
     * Operações administrativas (criar/deletar usuários, bloquear/desbloquear)
     */
    adminOperations: (): boolean => {
      return this.hasRole('ROLE_ADMIN');
    },

    /**
     * Reset de senha de outros usuários
     */
    passwordReset: (): boolean => {
      return this.hasAnyRole(['ROLE_ADMIN', 'ROLE_ANALISTA', 'ROLE_FUNCIONARIO']);
    },

    /**
     * Gráficos e relatórios
     */
    chartsAndReports: (): boolean => {
      return this.hasAnyRole(['ROLE_ADMIN', 'ROLE_ANALISTA']);
    },

    /**
     * Visualização completa de dados de clientes
     */
    fullClientView: (): boolean => {
      return this.hasAnyRole(['ROLE_ADMIN', 'ROLE_ANALISTA']);
    },

    /**
     * Visualização básica de clientes (apenas nome, email, status)
     */
    basicClientView: (): boolean => {
      return this.hasRole('ROLE_FUNCIONARIO');
    },

    /**
     * Cliente só pode editar seus próprios dados (endereço, documentos, contato, senha)
     */
    editOwnProfile: (): boolean => {
      return this.hasRole('ROLE_CLIENTE');
    }
  };
}
