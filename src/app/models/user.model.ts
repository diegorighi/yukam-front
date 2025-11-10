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
