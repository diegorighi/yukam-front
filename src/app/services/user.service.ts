import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserResponse } from '../models/user.model';

/**
 * User Service
 * Serviço para integração com o microserviço user-core
 * Base URL: /api (usa proxy Nginx para user-core-app:8182)
 */
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly baseUrl = '/api';

  constructor(private http: HttpClient) {}

  /**
   * Busca usuário por UUID público
   * Endpoint: GET /api/users/public/{publicId}
   * @param publicId UUID público do usuário
   * @returns Observable<UserResponse> com dados do usuário (login, email, theme, twoFactorEnabled)
   */
  getUserByPublicId(publicId: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/users/public/${publicId}`);
  }

  /**
   * Inicia processo de reset de senha via email
   * Endpoint: POST /api/password/recuperar/{publicId}
   * Envia email com link válido por 15 minutos
   * @param publicId UUID público do usuário
   * @returns Observable<void>
   */
  initiatePasswordReset(publicId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/password/recuperar/${publicId}`, {});
  }

  /**
   * Reset manual de senha (brute force)
   * Endpoint: POST /api/password/alterar
   * Permite funcionário alterar senha diretamente
   * @param publicId UUID público do usuário
   * @param newPassword Nova senha
   * @returns Observable<void>
   */
  manualPasswordReset(publicId: string, newPassword: string): Observable<void> {
    const payload = {
      publicId,
      newPassword
    };
    return this.http.post<void>(`${this.baseUrl}/password/alterar`, payload);
  }
}
