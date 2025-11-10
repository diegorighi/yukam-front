/**
 * User Response Model
 * Interface para resposta da API do microserviço user-core
 */
export interface UserResponse {
  publicId: string;
  login: string;
  email: string | null;
  theme: string;
  twoFactorEnabled: boolean;
  roles: string[]; // Array de roles (e.g., ["ROLE_ADMIN", "ROLE_CLIENTE"])
}

/**
 * Login Request
 * Payload para autenticação
 */
export interface LoginRequest {
  login: string;
  password: string;
}

/**
 * Auth State
 * Estado de autenticação do usuário
 */
export interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
}

/**
 * Stored Auth Data
 * Estrutura versionada para armazenamento seguro de dados de autenticação
 * Previne incompatibilidades ao atualizar o sistema
 */
export interface StoredAuthData {
  version: string;        // Versão do schema (semantic versioning)
  user: UserResponse;     // Dados completos do usuário
  timestamp: number;      // Timestamp de quando foi salvo (para expiração opcional)
}

/**
 * Initiate Password Reset Request
 * Payload para iniciar processo de reset de senha
 */
export interface InitiatePasswordResetRequest {
  publicId: string;
}

/**
 * Complete Password Reset Request
 * Payload para completar processo de reset de senha (reset manual)
 */
export interface CompletePasswordResetRequest {
  publicId: string;
  newPassword: string;
}
