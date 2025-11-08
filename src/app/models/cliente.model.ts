export interface ClientePF {
  publicId: string;
  primeiroNome: string;
  nomeDoMeio?: string;
  sobrenome: string;
  nomeCompleto: string;
  cpf: string;
  rg?: string;
  dataNascimento?: string;
  idade?: number;
  sexo?: string;
  email?: string;
  nomeMae?: string;
  nomePai?: string;
  estadoCivil?: string;
  profissao?: string;
  nacionalidade?: string;
  naturalidade?: string;
  tipoCliente?: string;
  origemLead?: string;
  totalComprasRealizadas?: number;
  totalVendasRealizadas?: number;
  valorTotalComprado?: number;
  valorTotalVendido?: number;
  bloqueado?: boolean;
  motivoBloqueio?: string;
  observacoes?: string;
  ativo?: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface ClientePJ {
  publicId: string;
  razaoSocial: string;
  nomeFantasia: string;
  nomeExibicao: string;
  cnpj: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  dataAbertura?: string;
  porteEmpresa?: string;
  naturezaJuridica?: string;
  atividadePrincipal?: string;
  capitalSocial?: number;
  nomeResponsavel?: string;
  cpfResponsavel?: string;
  cargoResponsavel?: string;
  site?: string;
  email?: string;
  tipoCliente?: string;
  origemLead?: string;
  totalComprasRealizadas?: number;
  totalVendasRealizadas?: number;
  valorTotalComprado?: number;
  valorTotalVendido?: number;
  bloqueado?: boolean;
  motivoBloqueio?: string;
  observacoes?: string;
  ativo?: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface PageResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export type TipoPessoa = 'PF' | 'PJ';
