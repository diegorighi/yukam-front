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
