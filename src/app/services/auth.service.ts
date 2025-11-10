import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { UserResponse, LoginRequest, StoredAuthData } from '../models/user.model';

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
  private readonly STORAGE_VERSION = '1.0.0'; // Versão do schema de dados

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
        // Salvar usuário no signal e localStorage com versionamento
        this.currentUser.set(user);

        const dataToStore: StoredAuthData = {
          version: this.STORAGE_VERSION,
          user: user,
          timestamp: Date.now()
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        console.log(`[AuthService] Sessão salva com versão ${this.STORAGE_VERSION}`);
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
   * Força limpeza completa de autenticação
   * Útil para resolver estados corrompidos
   */
  clearAuthState(): void {
    console.log('Limpando estado de autenticação...');
    this.currentUser.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Verifica se o usuário está autenticado
   * @returns boolean - true se usuário está logado COM DADOS VÁLIDOS
   */
  isAuthenticated(): boolean {
    const user = this.currentUser();

    // Verificação robusta: usuário deve ter publicId, login E roles válidas
    if (!user || !user.publicId || !user.login) {
      return false;
    }

    // CRÍTICO: Usuário DEVE ter pelo menos uma role válida
    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      console.error('ERRO: Usuário sem roles válidas detectado. Limpando sessão...');
      this.logout();
      return false;
    }

    return true;
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
   *
   * Sistema de versionamento:
   * - Valida versão do schema antes de carregar
   * - Tenta migrar dados antigos se possível
   * - Limpa automaticamente dados incompatíveis
   */
  private loadUserFromStorage(): void {
    const storedData = localStorage.getItem(this.STORAGE_KEY);
    if (!storedData) {
      return;
    }

    try {
      const parsed = JSON.parse(storedData);

      // Verificar se é formato novo (com version) ou antigo
      if (this.isStoredAuthData(parsed)) {
        // Formato novo com versionamento
        this.handleVersionedData(parsed);
      } else if (this.isUserResponse(parsed)) {
        // Formato antigo (sem version) - tentar migrar
        console.warn('[AuthService] Formato antigo detectado. Migrando para v1.0.0...');
        this.migrateOldData(parsed);
      } else {
        // Dados inválidos
        console.error('[AuthService] Dados inválidos no localStorage. Limpando...');
        this.clearStorage();
      }
    } catch (error) {
      console.error('[AuthService] Erro ao carregar usuário do localStorage:', error);
      this.clearStorage();
    }
  }

  /**
   * Processa dados versionados do localStorage
   */
  private handleVersionedData(data: StoredAuthData): void {
    // Validação de versão
    if (data.version !== this.STORAGE_VERSION) {
      console.warn(
        `[AuthService] Schema version mismatch. ` +
        `Esperado: ${this.STORAGE_VERSION}, Encontrado: ${data.version}. ` +
        `Limpando storage...`
      );
      this.clearStorage();
      return;
    }

    // Validação de dados do usuário
    const user = data.user;
    if (this.isValidUser(user)) {
      this.currentUser.set(user);
      console.log(`[AuthService] Sessão carregada com sucesso (v${data.version})`);
    } else {
      console.error('[AuthService] Dados de usuário inválidos. Limpando storage...');
      this.clearStorage();
    }
  }

  /**
   * Migra dados do formato antigo para o novo formato versionado
   */
  private migrateOldData(oldUser: UserResponse): void {
    if (this.isValidUser(oldUser)) {
      const migratedData: StoredAuthData = {
        version: this.STORAGE_VERSION,
        user: oldUser,
        timestamp: Date.now()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(migratedData));
      this.currentUser.set(oldUser);
      console.log('[AuthService] Migração concluída com sucesso');
    } else {
      console.error('[AuthService] Dados antigos inválidos. Não é possível migrar.');
      this.clearStorage();
    }
  }

  /**
   * Type guard para StoredAuthData
   */
  private isStoredAuthData(data: any): data is StoredAuthData {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.version === 'string' &&
      typeof data.timestamp === 'number' &&
      data.user &&
      typeof data.user === 'object'
    );
  }

  /**
   * Type guard para UserResponse
   */
  private isUserResponse(data: any): data is UserResponse {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.publicId === 'string' &&
      typeof data.login === 'string'
    );
  }

  /**
   * Valida se um objeto UserResponse tem todos os campos necessários
   */
  private isValidUser(user: UserResponse): boolean {
    return !!(
      user &&
      user.publicId &&
      user.login &&
      Array.isArray(user.roles) &&
      user.roles.length > 0
    );
  }

  /**
   * Limpa completamente o localStorage e estado de autenticação
   */
  private clearStorage(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUser.set(null);
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
