import { Component, ViewChild, ElementRef, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardNavbarComponent } from '../../components/dashboard-navbar/dashboard-navbar.component';
import { LoadingComponent } from '../../components/loading/loading.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../components/breadcrumbs/breadcrumbs.component';
import { ClienteService } from '../../services/cliente.service';
import { ClientePF, ClientePJ, TipoPessoa } from '../../models/cliente.model';
import ApexCharts from 'apexcharts';

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
export class DashboardComponent {
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
  showDetail = signal(false);
  isFullDetail = signal(false); // true para busca por UUID (todos os dados), false para listagem/CPF (dados mínimos)

  // Toast de notificação
  showToast = signal(false);
  toastMessage = signal('');

  // Dados de Leads para o relatório (serão carregados do backend)
  leadsData: LeadSource[] = [];
  isLoadingLeads = signal(false);

  constructor(private clienteService: ClienteService) {}

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
      }
    }

    this.breadcrumbs.set(crumbs);
  }

  // Carrega lista de clientes
  loadClientes() {
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

          // Carrega todos os clientes PF em paralelo para contar os ativos
          this.clienteService.listClientesPF(0, 10000).subscribe({
            next: (allResponse: any) => {
              const totalAtivos = allResponse.content.filter((c: any) => c.ativo === true).length;

              setTimeout(() => {
                // Filtra apenas clientes ativos no frontend
                const clientesAtivos = response.content.filter((c: any) => c.ativo === true);
                // Limita ao tamanho de página solicitado pelo usuário
                const clientesLimitados = clientesAtivos.slice(0, this.pageSize);
                this.clientesPF.set(clientesLimitados);
                this.totalPages.set(response.totalPages);
                this.totalElements.set(totalAtivos);
                this.loading.set(false);
              }, remainingTime);
            }
          });
        },
        error: (err: any) => {
          this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
          this.loading.set(false);
          console.error('Erro ao carregar clientes:', err);
        }
      });
    } else {
      // Carrega a página solicitada para exibição
      this.clienteService.listClientesPJ(this.currentPage(), aumentedPageSize).subscribe({
        next: (response: any) => {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

          // Carrega todos os clientes PJ em paralelo para contar os ativos
          this.clienteService.listClientesPJ(0, 10000).subscribe({
            next: (allResponse: any) => {
              const totalAtivos = allResponse.content.filter((c: any) => c.ativo === true).length;

              setTimeout(() => {
                // Filtra apenas clientes ativos no frontend
                const clientesAtivos = response.content.filter((c: any) => c.ativo === true);
                // Limita ao tamanho de página solicitado pelo usuário
                const clientesLimitados = clientesAtivos.slice(0, this.pageSize);
                this.clientesPJ.set(clientesLimitados);
                this.totalPages.set(response.totalPages);
                this.totalElements.set(totalAtivos);
                this.loading.set(false);
              }, remainingTime);
            }
          });
        },
        error: (err: any) => {
          this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
          this.loading.set(false);
          console.error('Erro ao carregar clientes:', err);
        }
      });
    }
  }

  // Carrega o total de clientes ativos (PF + PJ)
  async loadTotalClientesAtivos() {
    try {
      const [responsePF, responsePJ] = await Promise.all([
        this.clienteService.listClientesPF(0, 1).toPromise(),
        this.clienteService.listClientesPJ(0, 1).toPromise()
      ]);

      if (responsePF && responsePJ) {
        // Pega totalElements de cada um e subtrai os inativos
        const totalPF = responsePF.totalElements;
        const totalPJ = responsePJ.totalElements;

        // Para calcular corretamente, precisamos buscar todos e filtrar
        // Mas como otimização, vamos buscar uma amostra maior
        const [allPF, allPJ] = await Promise.all([
          this.clienteService.listClientesPF(0, 10000).toPromise(),
          this.clienteService.listClientesPJ(0, 10000).toPromise()
        ]);

        if (allPF && allPJ) {
          const ativosPF = allPF.content.filter((c: any) => c.ativo === true).length;
          const ativosPJ = allPJ.content.filter((c: any) => c.ativo === true).length;
          this.totalClientesAtivos.set(ativosPF + ativosPJ);
        }
      }
    } catch (error) {
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
          this.loading.set(false);
          this.updateBreadcrumbs('searchByUuid', cliente.nome);
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
          this.loading.set(false);
          this.updateBreadcrumbs('searchByUuid', cliente.razaoSocial || cliente.nomeFantasia);
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
    this.showDetail.set(false);
    this.selectedCliente.set(null);
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

    const nomeCliente = this.tipoPessoa === 'PF'
      ? `${(cliente as any).primeiroNome} ${(cliente as any).sobrenome}`
      : (cliente as any).nomeFantasia;

    const motivo = prompt(`Tem certeza que deseja deletar o cliente "${nomeCliente}"?\n\nDigite o motivo da exclusão:`);

    if (motivo && motivo.trim()) {
      this.deleteCliente(cliente.publicId, motivo.trim());
    }
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

    const nomeCliente = this.tipoPessoa === 'PF'
      ? `${(cliente as any).primeiroNome} ${(cliente as any).sobrenome}`
      : (cliente as any).nomeFantasia;

    const motivo = prompt(`Tem certeza que deseja bloquear o cliente "${nomeCliente}"?\n\nDigite o motivo do bloqueio:`);

    if (motivo && motivo.trim()) {
      this.bloquearCliente(cliente.publicId, motivo.trim());
    }
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
    this.isLoadingLeads.set(true);
    this.error.set(null);

    try {
      // Busca apenas uma página grande para pegar todos os dados necessários de uma vez
      const [responsePF, responsePJ] = await Promise.all([
        this.clienteService.listClientesPF(0, 10000).toPromise(),
        this.clienteService.listClientesPJ(0, 10000).toPromise()
      ]);

      if (!responsePF || !responsePJ) {
        throw new Error('Falha ao carregar dados');
      }

      // Combina todos os clientes (PF + PJ) e filtra apenas ativos
      const allClientes = [...responsePF.content, ...responsePJ.content];
      const clientesAtivos = allClientes.filter(c => c.ativo === true);

      // Processa os dados de origemLead
      this.processLeadsData(clientesAtivos);

      // Espera o próximo ciclo de detecção de mudanças do Angular
      setTimeout(() => {
        this.renderLeadsChartWithRetry();
      }, 100);
    } catch (error) {
      console.error('Erro ao carregar dados de leads:', error);
      this.error.set('Erro ao carregar dados de leads. Verifique se o servidor está rodando.');
      this.isLoadingLeads.set(false);
    }
  }

  // Método auxiliar para renderizar o gráfico com retry e callback
  private renderLeadsChartWithRetry(attempt: number = 0): void {
    const maxAttempts = 20;

    if (this.leadsChartCanvas?.nativeElement) {
      console.log('Chart element found, rendering...');

      // Desliga o loading ANTES de inicializar o gráfico
      // Isso permite que o usuário veja a animação gradual (clockwise fill)
      setTimeout(() => {
        this.isLoadingLeads.set(false);

        // Renderiza o gráfico logo após o loading desaparecer
        // O pequeno delay garante que a transição CSS do loading termine
        setTimeout(() => {
          this.initLeadsChart();
        }, 100);
      }, 300);
    } else if (attempt < maxAttempts) {
      console.log(`Chart element not found, attempt ${attempt + 1}/${maxAttempts}`);
      setTimeout(() => {
        this.renderLeadsChartWithRetry(attempt + 1);
      }, 200);
    } else {
      console.error('Chart element not found after maximum attempts');
      this.error.set('Erro ao renderizar gráfico. Elemento não encontrado.');
      this.isLoadingLeads.set(false);
    }
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
}
