import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ClientePF, ClientePJ, PageResponse } from '../models/cliente.model';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  private apiUrl = 'http://localhost:8081/api/clientes/v1/clientes';

  constructor(private http: HttpClient) { }

  // Pessoa Física
  listClientesPF(page: number = 0, size: number = 20, sort: string = 'id', direction: string = 'ASC'): Observable<PageResponse<ClientePF>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort)
      .set('direction', direction);
    // NOTA: O backend ainda não suporta o parâmetro 'ativo'
    // Filtragem está sendo feita no frontend até o backend ser atualizado

    return this.http.get<PageResponse<ClientePF>>(`${this.apiUrl}/pf`, { params });
  }

  getClientePFById(publicId: string): Observable<ClientePF> {
    return this.http.get<ClientePF>(`${this.apiUrl}/pf/${publicId}`);
  }

  getClientePFByCpf(cpf: string): Observable<{ primeiroNome: string; sobrenome: string; publicId: string }> {
    return this.http.get<{ primeiroNome: string; sobrenome: string; publicId: string }>(`${this.apiUrl}/pf/cpf/${cpf}`);
  }

  deleteClientePF(publicId: string, motivo: string, usuario: string): Observable<void> {
    const params = new HttpParams()
      .set('motivo', motivo)
      .set('usuario', usuario);

    return this.http.delete<void>(`${this.apiUrl}/pf/${publicId}`, { params });
  }

  restaurarClientePF(publicId: string, usuario: string): Observable<void> {
    const params = new HttpParams().set('usuario', usuario);
    return this.http.post<void>(`${this.apiUrl}/pf/${publicId}/restaurar`, null, { params });
  }

  updateClientePF(publicId: string, cliente: Partial<ClientePF>): Observable<ClientePF> {
    return this.http.put<ClientePF>(`${this.apiUrl}/pf/${publicId}`, cliente);
  }

  bloquearClientePF(publicId: string, motivo: string, usuario: string): Observable<void> {
    const body = {
      motivoBloqueio: motivo,
      usuarioBloqueou: usuario
    };
    return this.http.patch<void>(`${this.apiUrl}/pf/${publicId}/bloquear`, body);
  }

  desbloquearClientePF(publicId: string, usuario: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/pf/${publicId}/desbloquear`, null);
  }

  // Pessoa Jurídica
  listClientesPJ(page: number = 0, size: number = 20, sort: string = 'id', direction: string = 'ASC'): Observable<PageResponse<ClientePJ>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort)
      .set('direction', direction);
    // NOTA: O backend ainda não suporta o parâmetro 'ativo'
    // Filtragem está sendo feita no frontend até o backend ser atualizado

    return this.http.get<PageResponse<ClientePJ>>(`${this.apiUrl}/pj`, { params });
  }

  getClientePJById(publicId: string): Observable<ClientePJ> {
    return this.http.get<ClientePJ>(`${this.apiUrl}/pj/${publicId}`);
  }

  getClientePJByCnpj(cnpj: string): Observable<{ nomeFantasia: string; publicId: string }> {
    return this.http.get<{ nomeFantasia: string; publicId: string }>(`${this.apiUrl}/pj/cnpj/${cnpj}`);
  }

  deleteClientePJ(publicId: string, motivo: string, usuario: string): Observable<void> {
    const params = new HttpParams()
      .set('motivo', motivo)
      .set('usuario', usuario);

    return this.http.delete<void>(`${this.apiUrl}/pj/${publicId}`, { params });
  }

  restaurarClientePJ(publicId: string, usuario: string): Observable<void> {
    const params = new HttpParams().set('usuario', usuario);
    return this.http.post<void>(`${this.apiUrl}/pj/${publicId}/restaurar`, null, { params });
  }

  updateClientePJ(publicId: string, cliente: Partial<ClientePJ>): Observable<ClientePJ> {
    return this.http.put<ClientePJ>(`${this.apiUrl}/pj/${publicId}`, cliente);
  }

  bloquearClientePJ(publicId: string, motivo: string, usuario: string): Observable<void> {
    const body = {
      motivoBloqueio: motivo,
      usuarioBloqueou: usuario
    };
    return this.http.patch<void>(`${this.apiUrl}/pj/${publicId}/bloquear`, body);
  }

  desbloquearClientePJ(publicId: string, usuario: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/pj/${publicId}/desbloquear`, null);
  }
}
