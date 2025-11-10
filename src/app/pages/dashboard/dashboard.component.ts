import { Component, ViewChild, ElementRef, signal, ViewEncapsulation, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardNavbarComponent } from '../../components/dashboard-navbar/dashboard-navbar.component';
import { LoadingComponent } from '../../components/loading/loading.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../components/breadcrumbs/breadcrumbs.component';
import { ClienteService } from '../../services/cliente.service';
import { ClientePF, ClientePJ, TipoPessoa } from '../../models/cliente.model';
import { UserService } from '../../services/user.service';
import { UserResponse } from '../../models/user.model';
import ApexCharts from 'apexcharts';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

type ActionType =
  | 'list'
  | 'searchByCpfCnpj'
  | 'searchByUuid'
  | 'update'
  | 'listInactive'
  | 'reportLeads'
  | 'reportClientesPorRegiao'
  | 'reportTopVendedores'
  | 'reportTopCompradores'
  | 'reportClientesBloqueados'
  | 'reportNovosClientes'
  | 'reportFaixaEtaria'
  | 'reportPorTipoCliente'
  | 'reportEstadoCivil'
  | 'reportVolumeVendas'
  | 'reportOrigemLead'
  | 'reportPFvsPJ'
  | 'passwordReset'
  | null;

interface LeadSource {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavbarComponent, LoadingComponent, BreadcrumbsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardComponent implements OnDestroy {
  @ViewChild(DashboardNavbarComponent) navbar!: DashboardNavbarComponent;
  @ViewChild('leadsChart') leadsChartCanvas!: ElementRef<HTMLDivElement>;

  private leadsChart: ApexCharts | null = null;

  // Signals para estado
  clientesPF = signal<ClientePF[]>([]);
  clientesPJ = signal<ClientePJ[]>([]);
  loading = signal(false);
  loadingMessage = signal('Carregando...');
  error = signal<string | null>(null);

  // Paginação
  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);
  totalClientesAtivos = signal(0); // Total geral de clientes ativos (PF + PJ)
  private _pageSize = signal(8);
  pageSizeOptions = [4, 8, 12, 16, 20];

  // Auto-reload
  autoReloadMinutes = signal<number>(10); // padrão 10min
  private autoReloadHandle: number | null = null;

  get pageSize() {
    return this._pageSize();
  }

  set pageSize(value: number) {
    this._pageSize.set(value);
  }

  // Ação ativa no menu
  activeAction: ActionType = null;

  // Estado do menu lateral (hamburger) — inicia fechado
  sidebarOpen = signal(false);

  // Estado de collapse dos menus pai — todos iniciam fechados
  menuStates = signal<{[key: string]: boolean}>({
    clientes: false,
    relatorios: false,
    financeiro: false,
    configuracoes: false,
    ajuda: false
  });

  // Breadcrumbs
  breadcrumbs = signal<Breadcrumb[]>([]);

  // Busca
  searchTerm = '';
  uuidSearch = '';

  // Modal de detalhes
  selectedCliente = signal<ClientePF | ClientePJ | null>(null);
  selectedClienteUser = signal<UserResponse | null>(null); // Usuário relacionado ao cliente (user-core)
  showDetail = signal(false);
  isClosingDetail = signal(false);
  isSliderTransitioning = signal(false);
  isFullDetail = signal(false); // true para busca por UUID (todos os dados), false para listagem/CPF (dados mínimos)
  showBloqueioForm = signal(false); // Controla se está mostrando o formulário de bloqueio
  motivoBloqueio = '';
  showDeleteForm = signal(false); // Controla se está mostrando o formulário de deletar
  motivoDelete = '';

  // Toast de notificação
  showToast = signal(false);
  toastMessage = signal('');

  // Dados de Leads para o relatório (serão carregados do backend)
  leadsData: LeadSource[] = [];
  isLoadingLeads = signal(false);
  pendingLeadsReload = signal(false);
  selectedLeadIndex = signal<number | null>(null);
  
  // Controle de concorrência para listagem de clientes
  isLoadingClientes = signal(false);
  pendingClientesReload = signal(false);

  // Filtro de status (Ativos/Bloqueados)
  statusFilter = signal<'ativos' | 'bloqueados'>('ativos');

  // Password Reset
  passwordResetUuid = '';
  selectedUser = signal<UserResponse | null>(null);
  showPasswordResetModal = signal(false);
  showManualResetForm = signal(false);
  manualResetPassword = '';
  manualResetPasswordConfirm = '';

  toggleStatusFilter() {
    const next = this.statusFilter() === 'ativos' ? 'bloqueados' : 'ativos';
    this.statusFilter.set(next);
    // Recarrega a lista com o novo filtro
    if (this.activeAction === 'list') {
      this.loadClientes();
    }
  }

  constructor(
    private clienteService: ClienteService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  // Define/atualiza intervalo de auto-reload
  setAutoReload(minutes: number | string) {
    const min = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
    if (isNaN(min)) return;
    this.autoReloadMinutes.set(min);

    // Limpa anterior
    if (this.autoReloadHandle !== null) {
      window.clearInterval(this.autoReloadHandle);
      this.autoReloadHandle = null;
    }

    // Agenda novo (minutos > 0)
    if (min > 0) {
      // Atualiza imediatamente para refletir seleção
      this.loadClientes();
      this.autoReloadHandle = window.setInterval(() => {
        this.loadClientes();
      }, min * 60_000);
    }
  }

  // Limpa timers ao destruir
  ngOnDestroy(): void {
    if (this.autoReloadHandle !== null) {
      window.clearInterval(this.autoReloadHandle);
      this.autoReloadHandle = null;
    }
  }

  get tipoPessoa(): TipoPessoa {
    return this.navbar?.getTipoPessoa() || 'PF';
  }

  // Alterna o estado do sidebar
  toggleSidebar() {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  // Alterna o estado de um menu pai
  toggleMenu(menuKey: string) {
    const currentStates = this.menuStates();
    this.menuStates.set({
      ...currentStates,
      [menuKey]: !currentStates[menuKey]
    });
  }

  // Clique no cabeçalho da categoria: quando colapsado, abre sidebar e expande a categoria
  onCategoryHeaderClick(menuKey: string) {
    if (!this.sidebarOpen()) {
      this.sidebarOpen.set(true);
      const states = this.menuStates();
      const newStates: {[key: string]: boolean} = {};
      for (const key of Object.keys(states)) {
        newStates[key] = key === menuKey;
      }
      this.menuStates.set(newStates);
    } else {
      this.toggleMenu(menuKey);
    }
  }

  // Verifica se um menu está expandido
  isMenuExpanded(menuKey: string): boolean {
    return this.menuStates()[menuKey];
  }

  // Reage à mudança de tipo de pessoa no navbar
  onTipoPessoaChange() {
    // Atualiza breadcrumbs
    this.updateBreadcrumbs(this.activeAction);

    // Se há uma ação ativa de listagem, recarrega os dados
    if (this.activeAction === 'list') {
      this.loading.set(true);
      this.loadingMessage.set('Atualizando dados...');

      // Pequeno delay para mostrar o loading
      setTimeout(() => {
        this.currentPage.set(0);
        this.loadClientes();
      }, 300);
    } else if (this.activeAction) {
      // Para outras ações, apenas limpa os dados e atualiza breadcrumbs
      this.clientesPF.set([]);
      this.clientesPJ.set([]);
      this.error.set(null);
      this.searchTerm = '';
      this.uuidSearch = '';
    }
  }

  // Define a ação ativa e reseta estados
  setActiveAction(action: ActionType) {
    this.activeAction = action;
    this.error.set(null);
    this.searchTerm = '';
    this.uuidSearch = '';
    this.updateBreadcrumbs(action);

    // Se selecionar "list", carrega automaticamente
    if (action === 'list') {
      this.currentPage.set(0);
      this.loadClientes();
    }

    // Se selecionar "reportLeads", carrega os dados de leads
    if (action === 'reportLeads') {
      this.loadLeadsData();
    }
  }

  // Atualiza breadcrumbs baseado na ação
  updateBreadcrumbs(action: ActionType, clienteName?: string) {
    const homeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
    const clientIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

    const crumbs: Breadcrumb[] = [];

    if (action) {
      const baseBreadcrumb: Breadcrumb = {
        label: 'Dashboard',
        icon: homeIcon
      };
      crumbs.push(baseBreadcrumb);
      const tipoPessoaLabel = this.tipoPessoa === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica';

      switch (action) {
        case 'list':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: 'Listar Todos',
            active: true
          });
          break;
        case 'searchByCpfCnpj':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: `Buscar por ${this.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}`,
            active: true
          });
          if (clienteName) {
            crumbs.push({
              label: clienteName,
              active: true
            });
          }
          break;
        case 'searchByUuid':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: 'Buscar por UUID',
            active: true
          });
          if (clienteName) {
            crumbs.push({
              label: clienteName,
              active: true
            });
          }
          break;
        case 'update':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: 'Atualizar Cliente',
            active: true
          });
          break;
        case 'listInactive':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: 'Clientes Inativos',
            active: true
          });
          break;
        case 'reportLeads':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Leads',
            active: true
          });
          break;
        case 'reportClientesPorRegiao':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Clientes por Região',
            active: true
          });
          break;
        case 'reportTopVendedores':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Top Vendedores',
            active: true
          });
          break;
        case 'reportTopCompradores':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Top Compradores',
            active: true
          });
          break;
        case 'reportClientesBloqueados':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Clientes Bloqueados',
            active: true
          });
          break;
        case 'reportNovosClientes':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Novos Clientes',
            active: true
          });
          break;
        case 'reportFaixaEtaria':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Clientes por Faixa Etária',
            active: true
          });
          break;
        case 'reportPorTipoCliente':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Por Tipo de Cliente',
            active: true
          });
          break;
        case 'reportEstadoCivil':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Por Estado Civil',
            active: true
          });
          break;
        case 'reportVolumeVendas':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Volume de Vendas',
            active: true
          });
          break;
        case 'reportOrigemLead':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'Por Origem de Lead',
            active: true
          });
          break;
        case 'reportPFvsPJ':
          crumbs.push({
            label: 'Relatórios',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
          });
          crumbs.push({
            label: 'PF vs PJ',
            active: true
          });
          break;
        case 'passwordReset':
          crumbs.push({
            label: 'Configurações',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="M4.93 4.93l2.12 2.12"></path><path d="M17.07 17.07l2.12 2.12"></path><path d="M4.93 19.07l2.12-2.12"></path><path d="M17.07 6.93l2.12-2.12"></path></svg>'
          });
          crumbs.push({
            label: 'Reset de Senha',
            active: true
          });
          break;
      }
    }

    this.breadcrumbs.set(crumbs);
  }

  // Carrega lista de clientes
  loadClientes() {
    // Evita múltiplas requisições simultâneas que geram net::ERR_ABORTED
    if (this.isLoadingClientes()) {
      // Marca que um reload deve acontecer após a requisição atual finalizar
      this.pendingClientesReload.set(true);
      return;
    }

    this.isLoadingClientes.set(true);
    this.loading.set(true);
    this.loadingMessage.set('Carregando clientes...');
    this.error.set(null);

    // Tempo mínimo de exibição do loading (em ms)
    const minLoadingTime = 500;
    const startTime = Date.now();

    // Solicita páginas extras para compensar clientes inativos filtrados
    // Multiplica por 3 para ter margem suficiente
    const aumentedPageSize = this.pageSize * 3;

      if (this.tipoPessoa === 'PF') {
        // Carrega a página solicitada para exibição
        this.clienteService.listClientesPF(this.currentPage(), aumentedPageSize).subscribe({
          next: (response: any) => {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

          const isBloqueados = this.statusFilter() === 'bloqueados';
          const filterFn = (c: any) => {
            if (isBloqueados) {
              return c.bloqueado === true;
            }
            return c.ativo === true && c.bloqueado !== true;
          };

            setTimeout(() => {
              const clientesFiltrados = response.content.filter(filterFn);
              const clientesLimitados = clientesFiltrados.slice(0, this.pageSize);
              this.clientesPF.set(clientesLimitados);
              // Mantém contagem e paginação do backend para evitar requisição adicional
              this.totalPages.set(response.totalPages);
              this.totalElements.set(response.totalElements);
              this.loading.set(false);
              this.isLoadingClientes.set(false);
              if (this.pendingClientesReload()) {
                this.pendingClientesReload.set(false);
                // Reagenda o novo carregamento para o próximo tick
                setTimeout(() => this.loadClientes(), 0);
              }
            }, remainingTime);
          },
          error: (err: any) => {
            // Ignora cancelamentos (status 0) que geram ERR_ABORTED ao alternar rapidamente
            if (err?.status === 0) {
              // Mesmo ignorando visualmente, finaliza estado de loading de clientes
              this.loading.set(false);
              this.isLoadingClientes.set(false);
              if (this.pendingClientesReload()) {
                this.pendingClientesReload.set(false);
                setTimeout(() => this.loadClientes(), 0);
              }
              return;
            }
            this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
            this.loading.set(false);
            this.isLoadingClientes.set(false);
            if (this.pendingClientesReload()) {
              this.pendingClientesReload.set(false);
              setTimeout(() => this.loadClientes(), 0);
            }
            console.error('Erro ao carregar clientes:', err);
          }
        });
      } else {
        // Carrega a página solicitada para exibição
        this.clienteService.listClientesPJ(this.currentPage(), aumentedPageSize).subscribe({
          next: (response: any) => {
            const elapsedTime = Date.now() - startTime;
            const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

          const isBloqueados = this.statusFilter() === 'bloqueados';
          const filterFn = (c: any) => {
            if (isBloqueados) {
              return c.bloqueado === true;
            }
            return c.ativo === true && c.bloqueado !== true;
          };

            setTimeout(() => {
              const clientesFiltrados = response.content.filter(filterFn);
              const clientesLimitados = clientesFiltrados.slice(0, this.pageSize);
              this.clientesPJ.set(clientesLimitados);
              // Mantém contagem e paginação do backend para evitar requisição adicional
              this.totalPages.set(response.totalPages);
              this.totalElements.set(response.totalElements);
              this.loading.set(false);
              this.isLoadingClientes.set(false);
              if (this.pendingClientesReload()) {
                this.pendingClientesReload.set(false);
                setTimeout(() => this.loadClientes(), 0);
              }
            }, remainingTime);
          },
          error: (err: any) => {
            if (err?.status === 0) {
              this.loading.set(false);
              this.isLoadingClientes.set(false);
              if (this.pendingClientesReload()) {
                this.pendingClientesReload.set(false);
                setTimeout(() => this.loadClientes(), 0);
              }
              return;
            }
            this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
            this.loading.set(false);
            this.isLoadingClientes.set(false);
            if (this.pendingClientesReload()) {
              this.pendingClientesReload.set(false);
              setTimeout(() => this.loadClientes(), 0);
            }
            console.error('Erro ao carregar clientes:', err);
          }
        });
      }
    }

  // Carrega o total de clientes ativos (PF + PJ)
  async loadTotalClientesAtivos() {
    try {
      // Versões com supressão de abortos (status 0) para evitar logs duplicados
      const pfOne$ = this.clienteService
        .listClientesPF(0, 1)
        .pipe(
          catchError((err) => {
            if (this.isAbortError(err)) {
              return of({ totalElements: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const pjOne$ = this.clienteService
        .listClientesPJ(0, 1)
        .pipe(
          catchError((err) => {
            if (this.isAbortError(err)) {
              return of({ totalElements: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const [responsePF, responsePJ] = await Promise.all([
        firstValueFrom(pfOne$),
        firstValueFrom(pjOne$)
      ]);

      // Para calcular corretamente, buscamos um lote maior e filtramos ativos
      const pfAll$ = this.clienteService
        .listClientesPF(0, 10000)
        .pipe(
          catchError((err) => {
            if (this.isAbortError(err)) {
              return of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const pjAll$ = this.clienteService
        .listClientesPJ(0, 10000)
        .pipe(
          catchError((err) => {
            if (this.isAbortError(err)) {
              return of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const [allPF, allPJ] = await Promise.all([
        firstValueFrom(pfAll$),
        firstValueFrom(pjAll$)
      ]);

      const ativosPF = (allPF?.content ?? []).filter((c: any) => c.ativo === true).length;
      const ativosPJ = (allPJ?.content ?? []).filter((c: any) => c.ativo === true).length;
      this.totalClientesAtivos.set(ativosPF + ativosPJ);
    } catch (error: any) {
      // Suprime abortos; registra outros erros para diagnóstico
      if (this.isAbortError(error)) {
        return;
      }
      console.error('Erro ao carregar total de clientes ativos:', error);
    }
  }

  // Busca por CPF ou CNPJ
  searchByCpfOrCnpj() {
    if (!this.searchTerm.trim()) {
      this.error.set('Por favor, digite um ' + (this.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'));
      return;
    }

    this.loading.set(true);
    this.loadingMessage.set('Buscando cliente...');
    this.error.set(null);

    if (this.tipoPessoa === 'PF') {
      this.clienteService.getClientePFByCpf(this.searchTerm).subscribe({
        next: (response: any) => {
          this.clienteService.getClientePFById(response.publicId).subscribe({
            next: (cliente: any) => {
              this.selectedCliente.set(cliente);
              this.isFullDetail.set(false); // Modal mínimo para busca por CPF
              this.showDetail.set(true);
              this.loading.set(false);
              this.updateBreadcrumbs('searchByCpfCnpj', cliente.nome);
            },
            error: (err: any) => {
              this.error.set('Erro ao buscar detalhes do cliente.');
              this.loading.set(false);
            }
          });
        },
        error: (err: any) => {
          this.error.set('CPF não encontrado.');
          this.loading.set(false);
        }
      });
    } else {
      this.clienteService.getClientePJByCnpj(this.searchTerm).subscribe({
        next: (response: any) => {
          this.clienteService.getClientePJById(response.publicId).subscribe({
            next: (cliente: any) => {
              this.selectedCliente.set(cliente);
              this.isFullDetail.set(false); // Modal mínimo para busca por CNPJ
              this.showDetail.set(true);
              this.loading.set(false);
              this.updateBreadcrumbs('searchByCpfCnpj', cliente.razaoSocial || cliente.nomeFantasia);
            },
            error: (err: any) => {
              this.error.set('Erro ao buscar detalhes do cliente.');
              this.loading.set(false);
            }
          });
        },
        error: (err: any) => {
          this.error.set('CNPJ não encontrado.');
          this.loading.set(false);
        }
      });
    }
  }

  // Busca por UUID
  searchByUuid() {
    if (!this.uuidSearch.trim()) {
      this.error.set('Por favor, digite um UUID válido');
      return;
    }

    this.loading.set(true);
    this.loadingMessage.set('Buscando cliente...');
    this.error.set(null);

    if (this.tipoPessoa === 'PF') {
      this.clienteService.getClientePFById(this.uuidSearch).subscribe({
        next: (cliente: any) => {
          this.selectedCliente.set(cliente);
          this.isFullDetail.set(true); // Modal completo para busca por UUID
          this.showDetail.set(true);
          this.updateBreadcrumbs('searchByUuid', cliente.nome);

          // Buscar usuário relacionado (user-core)
          this.userService.getUserByPublicId(cliente.publicId).subscribe({
            next: (user) => {
              this.selectedClienteUser.set(user);
              this.cdr.detectChanges();
            },
            error: (err) => {
              this.selectedClienteUser.set(null);
              this.cdr.detectChanges();
            }
          });

          this.loading.set(false);
        },
        error: (err: any) => {
          this.error.set('Cliente não encontrado com este UUID.');
          this.loading.set(false);
          console.error('Erro ao buscar cliente:', err);
        }
      });
    } else {
      this.clienteService.getClientePJById(this.uuidSearch).subscribe({
        next: (cliente: any) => {
          this.selectedCliente.set(cliente);
          this.isFullDetail.set(true); // Modal completo para busca por UUID
          this.showDetail.set(true);
          this.updateBreadcrumbs('searchByUuid', cliente.razaoSocial || cliente.nomeFantasia);

          // Buscar usuário relacionado (user-core)
          this.userService.getUserByPublicId(cliente.publicId).subscribe({
            next: (user) => {
              this.selectedClienteUser.set(user);
              this.cdr.detectChanges();
            },
            error: (err) => {
              this.selectedClienteUser.set(null);
              this.cdr.detectChanges();
            }
          });

          this.loading.set(false);
        },
        error: (err: any) => {
          this.error.set('Cliente não encontrado com este UUID.');
          this.loading.set(false);
          console.error('Erro ao buscar cliente:', err);
        }
      });
    }
  }

  // Visualiza detalhes do cliente
  viewClienteDetails(cliente: ClientePF | ClientePJ) {
    // Usa os dados que já temos da lista ao invés de recarregar do backend
    // Isso evita problemas com cache do Hibernate no backend
    this.selectedCliente.set(cliente);
    this.isFullDetail.set(false); // Modal mínimo para listagem
    this.showDetail.set(true);
  }

  // Fecha modal de detalhes
  closeDetail() {
    if (!this.showDetail()) {
      return;
    }
    // aciona animação de saída antes de remover do DOM
    this.isClosingDetail.set(true);
    window.setTimeout(() => {
      this.showDetail.set(false);
      this.isClosingDetail.set(false);
      this.selectedCliente.set(null);
      this.selectedClienteUser.set(null); // Limpa dados do usuário
      this.showBloqueioForm.set(false);
      this.motivoBloqueio = '';
      this.showDeleteForm.set(false);
      this.motivoDelete = '';
    }, 380); // sincronizado com duração do slideUpBlind
  }

  // Mascara login do cliente (LGPD) - mostra apenas 2 primeiros e 2 últimos caracteres
  maskedClienteLogin(): string {
    const login = this.selectedClienteUser()?.login;
    if (!login || login.length <= 4) return login || '';
    const first = login.substring(0, 2);
    const last = login.substring(login.length - 2);
    const stars = '*'.repeat(Math.min(login.length - 4, 8));
    return `${first}${stars}${last}`;
  }

  // Paginação
  nextPage() {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadClientes();
    }
  }

  previousPage() {
    if (this.currentPage() > 0) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadClientes();
    }
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      this.loadClientes();
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];

    if (total <= 7) {
      // Se tem 7 ou menos páginas, mostra todas
      for (let i = 0; i < total; i++) {
        pages.push(i);
      }
    } else {
      // Sempre mostra primeira página
      pages.push(0);

      if (current > 2) {
        pages.push('...');
      }

      // Páginas ao redor da atual
      const start = Math.max(1, current - 1);
      const end = Math.min(total - 2, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 3) {
        pages.push('...');
      }

      // Sempre mostra última página
      pages.push(total - 1);
    }

    return pages;
  }

  changePageSize(newSize: number) {
    this.currentPage.set(0); // Volta para a primeira página
    this.loadClientes();
  }

  // Copiar para clipboard
  copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Mostra notificação toast
      this.toastMessage.set(`${label} copiado!`);
      this.showToast.set(true);

      // Remove o toast após 2 segundos
      setTimeout(() => {
        this.showToast.set(false);
      }, 2000);
    }).catch(err => {
      console.error('Erro ao copiar:', err);
      this.toastMessage.set('Erro ao copiar');
      this.showToast.set(true);
      setTimeout(() => {
        this.showToast.set(false);
      }, 2000);
    });
  }

  // Ações do cliente
  confirmDelete() {
    const cliente = this.selectedCliente();
    if (!cliente) return;

    // Ativa o formulário de deletar com animação slide-left
    this.isSliderTransitioning.set(true);
    this.showBloqueioForm.set(false);
    this.showDeleteForm.set(true);
    window.setTimeout(() => this.isSliderTransitioning.set(false), 450);
    this.motivoDelete = '';
  }

  cancelarDelete() {
    this.isSliderTransitioning.set(true);
    this.showDeleteForm.set(false);
    window.setTimeout(() => this.isSliderTransitioning.set(false), 450);
    this.motivoDelete = '';
  }

  executarDelete() {
    const cliente = this.selectedCliente();
    if (!cliente) return;

    if (!this.motivoDelete || !this.motivoDelete.trim()) {
      this.error.set('Por favor, informe o motivo da exclusão.');
      return;
    }

    this.deleteCliente(cliente.publicId, this.motivoDelete.trim());
    this.showDeleteForm.set(false);
    this.motivoDelete = '';
  }

  deleteCliente(publicId: string, motivo: string) {
    this.loading.set(true);
    this.loadingMessage.set('Deletando cliente...');

    const deleteObservable = this.tipoPessoa === 'PF'
      ? this.clienteService.deleteClientePF(publicId, motivo, 'sistema')
      : this.clienteService.deleteClientePJ(publicId, motivo, 'sistema');

    deleteObservable.subscribe({
      next: () => {
        this.toastMessage.set('Cliente deletado com sucesso!');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 2000);
        this.closeDetail();

        // Aguarda um pouco e recarrega a página atual
        // O backend automaticamente ajustará os cards (soft delete já aplicado)
        // O próximo card da lista virá para preencher o espaço
        setTimeout(() => {
          this.loadClientes();
          this.loading.set(false);
        }, 300);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Erro ao deletar cliente: ' + (err.error?.message || err.message));
      }
    });
  }

  confirmBloquear() {
    const cliente = this.selectedCliente();
    if (!cliente) return;

    // Ativa o formulário de bloqueio com animação slide-left
    this.isSliderTransitioning.set(true);
    this.showDeleteForm.set(false);
    this.showBloqueioForm.set(true);
    window.setTimeout(() => this.isSliderTransitioning.set(false), 450);
    this.motivoBloqueio = '';
  }

  cancelarBloqueio() {
    this.isSliderTransitioning.set(true);
    this.showBloqueioForm.set(false);
    window.setTimeout(() => this.isSliderTransitioning.set(false), 450);
    this.motivoBloqueio = '';
  }

  executarBloqueio() {
    const cliente = this.selectedCliente();
    if (!cliente) return;

    if (!this.motivoBloqueio || !this.motivoBloqueio.trim()) {
      this.error.set('Por favor, informe o motivo do bloqueio.');
      return;
    }

    this.bloquearCliente(cliente.publicId, this.motivoBloqueio.trim());
    this.showBloqueioForm.set(false);
    this.motivoBloqueio = '';
  }

  bloquearCliente(publicId: string, motivo: string) {
    this.loading.set(true);
    this.loadingMessage.set('Bloqueando cliente...');

    const bloquearObservable = this.tipoPessoa === 'PF'
      ? this.clienteService.bloquearClientePF(publicId, motivo, 'sistema')
      : this.clienteService.bloquearClientePJ(publicId, motivo, 'sistema');

    bloquearObservable.subscribe({
      next: () => {
        this.toastMessage.set('Cliente bloqueado com sucesso!');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 2000);

        // Aguarda um pouco para garantir que o backend commitou a transação
        // Depois recarrega a lista e os detalhes do cliente
        setTimeout(() => {
          this.loadClientes();
          this.reloadClienteDetail(publicId);
          this.loading.set(false);
        }, 300);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Erro ao bloquear cliente: ' + (err.error?.message || err.message));
      }
    });
  }

  confirmDesbloquear() {
    const cliente = this.selectedCliente();
    if (!cliente) return;

    const nomeCliente = this.tipoPessoa === 'PF'
      ? `${(cliente as any).primeiroNome} ${(cliente as any).sobrenome}`
      : (cliente as any).nomeFantasia;

    if (confirm(`Tem certeza que deseja desbloquear o cliente "${nomeCliente}"?`)) {
      this.desbloquearCliente(cliente.publicId);
    }
  }

  desbloquearCliente(publicId: string) {
    this.loading.set(true);
    this.loadingMessage.set('Desbloqueando cliente...');

    const desbloquearObservable = this.tipoPessoa === 'PF'
      ? this.clienteService.desbloquearClientePF(publicId, 'sistema')
      : this.clienteService.desbloquearClientePJ(publicId, 'sistema');

    desbloquearObservable.subscribe({
      next: () => {
        this.toastMessage.set('Cliente desbloqueado com sucesso!');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 2000);

        // Aguarda um pouco para garantir que o backend commitou a transação
        // Depois recarrega a lista e os detalhes do cliente
        setTimeout(() => {
          this.loadClientes();
          this.reloadClienteDetail(publicId);
          this.loading.set(false);
        }, 300);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Erro ao desbloquear cliente: ' + (err.error?.message || err.message));
      }
    });
  }

  // Recarrega os dados do cliente após operação de bloqueio/desbloqueio
  reloadClienteDetail(publicId: string) {
    if (this.tipoPessoa === 'PF') {
      this.clienteService.getClientePFById(publicId).subscribe({
        next: (cliente: ClientePF) => {
          this.selectedCliente.set(cliente);
        },
        error: (err: any) => {
          console.error('Erro ao recarregar dados do cliente:', err);
        }
      });
    } else {
      this.clienteService.getClientePJById(publicId).subscribe({
        next: (cliente: ClientePJ) => {
          this.selectedCliente.set(cliente);
        },
        error: (err: any) => {
          console.error('Erro ao recarregar dados do cliente:', err);
        }
      });
    }
  }

  // ==================== RELATÓRIOS ====================

  // Carrega todos os dados de leads do backend
  async loadLeadsData(): Promise<void> {
    // Evita sobreposição: se já estiver carregando, marca para recarregar ao final
    if (this.isLoadingLeads()) {
      this.pendingLeadsReload.set(true);
      return;
    }

    this.isLoadingLeads.set(true);
    this.error.set(null);

    try {
      // Busca apenas uma página grande para pegar todos os dados necessários de uma vez
      const pf$ = this.clienteService
        .listClientesPF(0, 10000)
        .pipe(
          catchError((err) => {
            // Ignora abortos de rede (status 0) para evitar logs duplicados
            if (this.isAbortError(err)) {
              return of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const pj$ = this.clienteService
        .listClientesPJ(0, 10000)
        .pipe(
          catchError((err) => {
            if (this.isAbortError(err)) {
              return of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 } as any);
            }
            return throwError(() => err);
          })
        );

      const [responsePF, responsePJ] = await Promise.all([
        firstValueFrom(pf$),
        firstValueFrom(pj$)
      ]);

      if (!responsePF || !responsePJ) {
        throw new Error('Falha ao carregar dados');
      }

      // Combina todos os clientes (PF + PJ) e filtra apenas ATIVOS, excluindo BLOQUEADOS e soft-delete (não ativos)
      const allClientes = [...responsePF.content, ...responsePJ.content];
      const clientesAtivos = allClientes.filter(c => c.ativo === true && c.bloqueado !== true);

      // Processa os dados de origemLead
      this.processLeadsData(clientesAtivos);

      // Espera o próximo ciclo de detecção de mudanças do Angular
      setTimeout(() => {
        this.renderLeadsChartWithRetry();
      }, 100);
    } catch (error: any) {
      // Suprime erros de aborto (status 0) para evitar ruído; trata demais normalmente
      if (this.isAbortError(error)) {
        this.isLoadingLeads.set(false);
        if (this.pendingLeadsReload()) {
          this.pendingLeadsReload.set(false);
          setTimeout(() => this.loadLeadsData(), 0);
        }
        return;
      }
      console.error('Erro ao carregar dados de leads:', error);
      this.error.set('Erro ao carregar dados de leads. Verifique se o servidor está rodando.');
      this.isLoadingLeads.set(false);
      // Se houver um reload pendente, drena a fila
      if (this.pendingLeadsReload()) {
        this.pendingLeadsReload.set(false);
        // Agenda recarga fresca fora do ciclo atual
        setTimeout(() => this.loadLeadsData(), 0);
      }
    }
  }

  // Método auxiliar para renderizar o gráfico com retry e callback
  private renderLeadsChartWithRetry(attempt: number = 0): void {
    const maxAttempts = 20;

    if (this.leadsChartCanvas?.nativeElement) {
      console.log('Chart element found, rendering...');

      // Mantém o loading ativo até que o gráfico finalize a animação (controlado pelos eventos do ApexCharts)
      // Se houver um reload pendente, drena a fila antes de renderizar
      if (this.pendingLeadsReload()) {
        this.pendingLeadsReload.set(false);
        setTimeout(() => this.loadLeadsData(), 0);
        return;
      }

      // Renderiza o gráfico com um pequeno delay para garantir que o container esteja visível e com dimensões calculadas
      setTimeout(() => {
        this.initLeadsChart();
        // Aplica destaque de fatia se houver seleção ativa
        this.applySliceSelection();
      }, 100);
    } else if (attempt < maxAttempts) {
      console.log(`Chart element not found, attempt ${attempt + 1}/${maxAttempts}`);
      setTimeout(() => {
        this.renderLeadsChartWithRetry(attempt + 1);
      }, 200);
    } else {
      console.error('Chart element not found after maximum attempts');
      this.error.set('Erro ao renderizar gráfico. Elemento não encontrado.');
      this.isLoadingLeads.set(false);
      // Se houver um reload pendente, drena a fila
      if (this.pendingLeadsReload()) {
        this.pendingLeadsReload.set(false);
        setTimeout(() => this.loadLeadsData(), 0);
      }
    }
  }

  private isAbortError(err: any): boolean {
    // HttpErrorResponse de requisição abortada costuma ter status === 0
    return !!err && (err.status === 0 || (typeof err.message === 'string' && err.message.includes('ERR_ABORTED')));
  }

  // Processa os dados de origemLead dos clientes
  processLeadsData(clientes: (ClientePF | ClientePJ)[]): void {
    // Mapa para contar as origens
    const origemCount: Map<string, number> = new Map();
    let totalComOrigem = 0;

    // Conta as origens
    clientes.forEach(cliente => {
      const origem = (cliente as any).origemLead;
      if (origem) {
        origemCount.set(origem, (origemCount.get(origem) || 0) + 1);
        totalComOrigem++;
      }
    });

    // Define cores mais escuras e saturadas para melhor legibilidade
    const colorMap: { [key: string]: string } = {
      'GOOGLE_ADS': '#2563EB',      // Azul mais escuro
      'INSTAGRAM': '#DB2777',       // Rosa mais escuro
      'FACEBOOK': '#1E40AF',        // Azul escuro
      'LINKEDIN': '#0284C7',        // Azul ciano escuro
      'ORGANICO': '#059669',        // Verde escuro
      'INDICACAO': '#D97706',       // Amarelo/laranja escuro
      'YOUTUBE': '#DC2626',         // Vermelho escuro
      'TWITTER': '#0EA5E9',         // Azul Twitter escuro
      'TIKTOK': '#C026D3',          // Magenta escuro
      'EMAIL_MARKETING': '#EA580C', // Laranja escuro
      'WHATSAPP': '#16A34A',        // Verde WhatsApp escuro
      'OUTROS': '#7C3AED'           // Roxo escuro
    };

    // Mapeia nomes amigáveis
    const labelMap: { [key: string]: string } = {
      'GOOGLE_ADS': 'Google Ads',
      'INSTAGRAM': 'Instagram',
      'FACEBOOK': 'Facebook',
      'LINKEDIN': 'LinkedIn',
      'ORGANICO': 'Orgânico (SEO)',
      'INDICACAO': 'Indicação',
      'YOUTUBE': 'YouTube',
      'TWITTER': 'Twitter',
      'TIKTOK': 'TikTok',
      'EMAIL_MARKETING': 'Email Marketing',
      'WHATSAPP': 'WhatsApp',
      'OUTROS': 'Outros'
    };

    // Converte para o formato do gráfico
    this.leadsData = Array.from(origemCount.entries())
      .map(([origem, count]) => ({
        label: labelMap[origem] || origem,
        value: count,
        percentage: totalComOrigem > 0 ? parseFloat(((count / totalComOrigem) * 100).toFixed(2)) : 0,
        color: colorMap[origem] || '#' + Math.floor(Math.random() * 16777215).toString(16)
      }))
      .sort((a, b) => b.value - a.value); // Ordena por valor decrescente
  }

  // Inicializa o gráfico de leads (donut chart) com ApexCharts
  initLeadsChart(): void {
    if (!this.leadsChartCanvas) {
      console.warn('Chart element not found');
      return;
    }

    // Destroy previous chart if exists
    if (this.leadsChart) {
      this.leadsChart.destroy();
    }

    // Ao reinicializar o gráfico, limpa seleção anterior
    this.selectedLeadIndex.set(null);

    const options = {
      series: this.leadsData.map(item => item.value),
      chart: {
        type: 'donut',
        height: 450,
        width: '100%',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 1200,
          animateGradually: {
            enabled: true,
            delay: 200
          },
          dynamicAnimation: {
            enabled: true,
            speed: 400
          }
        },
        events: {
          // Quando o gráfico terminar sua animação inicial, liberamos a tela
          animationEnd: () => {
            this.isLoadingLeads.set(false);
          },
          // Em montado, garantimos que ainda há loader ativo até o fim da animação
          mounted: () => {
            // Mantém loader até animationEnd para evitar exibição parcial
            // Caso as animações estejam desativadas, cai neste fallback
            setTimeout(() => {
              if (!options.chart.animations?.enabled) {
                this.isLoadingLeads.set(false);
              }
            }, 0);
          }
        },
        background: 'transparent',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      },
      labels: this.leadsData.map(item => item.label),
      colors: this.leadsData.map(item => item.color),
      plotOptions: {
        pie: {
          startAngle: 0,
          endAngle: 360,
          expandOnClick: true,
          donut: {
            size: '65%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '18px',
                fontWeight: 600,
                color: '#E0E0E0'
              },
              value: {
                show: true,
                fontSize: '28px',
                fontWeight: 700,
                color: '#00D9FF',
                formatter: (val: any) => {
                  return val.toString();
                }
              },
              total: {
                show: true,
                showAlways: true,
                label: 'Total de Leads',
                fontSize: '14px',
                fontWeight: 500,
                color: '#B0B0B0',
                formatter: () => {
                  return this.getTotalLeads().toString();
                }
              }
            }
          }
        }
      },
      dataLabels: {
        enabled: false
      },
      legend: {
        show: false
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        style: {
          fontSize: '14px',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        y: {
          formatter: (val: number) => {
            const total = this.getTotalLeads();
            const percentage = ((val / total) * 100).toFixed(2);
            return `${val} leads (${percentage}%)`;
          }
        }
      },
      stroke: {
        show: false
      },
      responsive: [{
        breakpoint: 768,
        options: {
          chart: {
            height: 350
          },
          plotOptions: {
            pie: {
              donut: {
                labels: {
                  name: {
                    fontSize: '14px'
                  },
                  value: {
                    fontSize: '20px'
                  },
                  total: {
                    fontSize: '12px'
                  }
                }
              }
            }
          }
        }
      }]
    };

    this.leadsChart = new ApexCharts(this.leadsChartCanvas.nativeElement, options);
    this.leadsChart.render();
  }

  // Seleciona/toggle uma fonte de lead pelo índice correspondente à fatia do gráfico
  onSelectLead(index: number): void {
    const current = this.selectedLeadIndex();
    this.selectedLeadIndex.set(current === index ? null : index);
    this.applySliceSelection();
  }

  // Limpa seleção ativa
  clearLeadSelection(): void {
    this.selectedLeadIndex.set(null);
    this.applySliceSelection();
  }

  // Aplica destaque visual à fatia selecionada ajustando as cores do gráfico
  private applySliceSelection(): void {
    if (!this.leadsChart) return;

    const selected = this.selectedLeadIndex();
    // Mantém cor viva na fatia selecionada e escurece as demais via cores RGBA
    const newColors = this.leadsData.map((item, i) =>
      selected === null ? item.color : (i === selected ? item.color : this.toRgba(item.color, 0.25))
    );

    try {
      this.leadsChart.updateOptions({ colors: newColors } as any);

      // Atualiza o label central para refletir seleção (valor e label)
      const selectedValue = selected !== null ? this.leadsData[selected].value : null;
      const selectedLabel = selected !== null ? this.leadsData[selected].label : 'Total de Leads';
      this.leadsChart.updateOptions({
        plotOptions: {
          pie: {
            donut: {
              labels: {
                total: {
                  show: true,
                  showAlways: true,
                  label: selectedLabel,
                  formatter: (w: any) => selected !== null
                    ? selectedValue
                    : w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)
                }
              }
            }
          }
        }
      } as any);

      // Aplica classe ao elemento da fatia selecionada para efeito de salto
      const applySliceClass = () => {
        const rootEl = this.leadsChartCanvas?.nativeElement;
        const sliceEls = rootEl ? rootEl.querySelectorAll('.apexcharts-pie-area .apexcharts-series') : null;
        if (sliceEls && sliceEls.length) {
          sliceEls.forEach((el, idx) => {
            if (selected !== null && idx === selected) {
              (el as HTMLElement).classList.add('slice-selected');
            } else {
              (el as HTMLElement).classList.remove('slice-selected');
            }
          });

          // Move a fatia selecionada para o topo da pilha (último filho) para sobrepor as demais
          if (selected !== null) {
            const pieArea = rootEl?.querySelector('.apexcharts-pie-area');
            const selectedEl = sliceEls[selected];
            if (pieArea && selectedEl && selectedEl.parentElement === pieArea) {
              pieArea.appendChild(selectedEl);
            }
          }
        }
      };
      // Aplica imediatamente e repete no próximo tick para garantir após re-render do ApexCharts
      applySliceClass();
      setTimeout(applySliceClass, 0);
    } catch (e) {
      console.warn('Falha ao aplicar seleção no gráfico:', e);
    }
  }

  // Converte uma cor hex/rgb para rgba com alpha controlado
  private toRgba(color: string, alpha: number): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    if (!color) return `rgba(255,255,255,${alpha})`;
    // Hex #RRGGBB ou #RGB
    if (color.startsWith('#')) {
      let r = 0, g = 0, b = 0;
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
      return `rgba(${clamp(r)},${clamp(g)},${clamp(b)},${alpha})`;
    }
    // rgb(...) ou rgba(...)
    if (color.startsWith('rgb')) {
      const nums = color.replace(/rgba?\(|\)/g, '').split(',').map(v => parseFloat(v.trim()));
      const r = clamp(nums[0] || 0);
      const g = clamp(nums[1] || 0);
      const b = clamp(nums[2] || 0);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    // fallback
    return color;
  }

  // Retorna o total de leads
  getTotalLeads(): number {
    return this.leadsData.reduce((sum, item) => sum + item.value, 0);
  }

  // Retorna a principal fonte de leads
  getTopLeadSource(): string {
    if (this.leadsData.length === 0) return '-';
    const topSource = this.leadsData.reduce((prev, current) =>
      prev.value > current.value ? prev : current
    );
    return topSource.label;
  }

  // Retorna a conversão média (mock data)
  getAverageConversion(): string {
    // TODO: Implementar cálculo real quando houver dados de conversão
    return '24.5';
  }

  // ==================== PASSWORD RESET ====================

  /**
   * Mascara o login do usuário para LGPD
   * Exibe apenas 2 primeiros e 2 últimos caracteres
   */
  maskedLogin(): string {
    const login = this.selectedUser()?.login;
    if (!login) return '***';
    if (login.length <= 4) return '***';
    return login.substring(0, 2) + '*'.repeat(login.length - 4) + login.substring(login.length - 2);
  }

  /**
   * Busca usuário pelo UUID para reset de senha
   */
  searchUserForPasswordReset() {
    if (!this.passwordResetUuid.trim()) {
      this.error.set('Digite um UUID válido');
      return;
    }

    this.loading.set(true);
    this.loadingMessage.set('Buscando usuário...');
    this.error.set(null);

    console.log('[DEBUG] Buscando usuário com UUID:', this.passwordResetUuid);

    this.userService.getUserByPublicId(this.passwordResetUuid).subscribe({
      next: (user) => {
        console.log('[DEBUG] Usuário encontrado:', user);
        this.selectedUser.set(user);
        console.log('[DEBUG] selectedUser signal atualizado:', this.selectedUser());
        this.showPasswordResetModal.set(true);
        console.log('[DEBUG] showPasswordResetModal signal atualizado:', this.showPasswordResetModal());
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[DEBUG] Erro ao buscar usuário:', err);
        this.error.set('Usuário não encontrado');
        this.loading.set(false);
      }
    });
  }

  /**
   * Fecha modal de reset de senha e limpa estado
   */
  closePasswordResetModal() {
    this.showPasswordResetModal.set(false);
    this.selectedUser.set(null);
    this.showManualResetForm.set(false);
    this.manualResetPassword = '';
    this.manualResetPasswordConfirm = '';
    this.passwordResetUuid = '';
  }

  /**
   * Envia email de reset de senha
   * Link válido por 15 minutos
   */
  sendPasswordResetEmail() {
    const publicId = this.selectedUser()?.publicId;
    if (!publicId) return;

    if (!this.selectedUser()?.email) {
      this.error.set('Usuário não possui email cadastrado');
      return;
    }

    this.loading.set(true);
    this.loadingMessage.set('Enviando email...');

    this.userService.initiatePasswordReset(publicId).subscribe({
      next: () => {
        this.toastMessage.set('Email de reset enviado com sucesso! Válido por 15 minutos.');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 3000);
        this.loading.set(false);
        this.closePasswordResetModal();
      },
      error: (err) => {
        this.error.set('Erro ao enviar email de reset');
        this.loading.set(false);
        console.error('Erro ao enviar email:', err);
      }
    });
  }

  /**
   * Executa reset manual de senha (brute force pelo funcionário)
   */
  executeManualReset() {
    if (!this.manualResetPassword || !this.manualResetPasswordConfirm) {
      this.error.set('Preencha todos os campos');
      return;
    }

    if (this.manualResetPassword !== this.manualResetPasswordConfirm) {
      this.error.set('As senhas não coincidem');
      return;
    }

    if (this.manualResetPassword.length < 6) {
      this.error.set('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    const publicId = this.selectedUser()?.publicId;
    if (!publicId) return;

    this.loading.set(true);
    this.loadingMessage.set('Alterando senha...');

    this.userService.manualPasswordReset(publicId, this.manualResetPassword).subscribe({
      next: () => {
        this.toastMessage.set('Senha alterada com sucesso!');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 2000);
        this.loading.set(false);
        this.closePasswordResetModal();
      },
      error: (err) => {
        this.error.set('Erro ao alterar senha');
        this.loading.set(false);
        console.error('Erro ao alterar senha:', err);
      }
    });
  }
}
