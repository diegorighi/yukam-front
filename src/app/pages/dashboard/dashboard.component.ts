import { Component, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardNavbarComponent } from '../../components/dashboard-navbar/dashboard-navbar.component';
import { LoadingComponent } from '../../components/loading/loading.component';
import { BreadcrumbsComponent, Breadcrumb } from '../../components/breadcrumbs/breadcrumbs.component';
import { ClienteService } from '../../services/cliente.service';
import { ClientePF, ClientePJ, TipoPessoa } from '../../models/cliente.model';

type ActionType = 'list' | 'searchByCpfCnpj' | 'searchByUuid' | 'update' | 'delete' | null;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardNavbarComponent, LoadingComponent, BreadcrumbsComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  @ViewChild(DashboardNavbarComponent) navbar!: DashboardNavbarComponent;

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

  // Estado do menu lateral (hamburger)
  sidebarOpen = signal(true);

  // Estado de collapse dos menus pai
  menuStates = signal<{[key: string]: boolean}>({
    clientes: true,
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
  }

  // Atualiza breadcrumbs baseado na ação
  updateBreadcrumbs(action: ActionType, clienteName?: string) {
    const homeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>';
    const clientIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';

    const baseBreadcrumb: Breadcrumb = {
      label: 'Dashboard',
      icon: homeIcon
    };

    const crumbs: Breadcrumb[] = [baseBreadcrumb];

    if (action) {
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
        case 'delete':
          crumbs.push({
            label: `Clientes ${tipoPessoaLabel}`,
            icon: clientIcon
          });
          crumbs.push({
            label: 'Deletar Cliente',
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
      this.clienteService.listClientesPF(this.currentPage(), aumentedPageSize).subscribe({
        next: (response: any) => {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

          setTimeout(() => {
            // Filtra apenas clientes ativos no frontend
            // TODO: Backend deve implementar filtro por 'ativo'
            const clientesAtivos = response.content.filter((c: any) => c.ativo === true);
            // Limita ao tamanho de página solicitado pelo usuário
            const clientesLimitados = clientesAtivos.slice(0, this.pageSize);
            this.clientesPF.set(clientesLimitados);
            this.totalPages.set(response.totalPages);
            this.totalElements.set(response.totalElements);
            this.loading.set(false);
          }, remainingTime);
        },
        error: (err: any) => {
          this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
          this.loading.set(false);
          console.error('Erro ao carregar clientes:', err);
        }
      });
    } else {
      this.clienteService.listClientesPJ(this.currentPage(), aumentedPageSize).subscribe({
        next: (response: any) => {
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

          setTimeout(() => {
            // Filtra apenas clientes ativos no frontend
            // TODO: Backend deve implementar filtro por 'ativo'
            const clientesAtivos = response.content.filter((c: any) => c.ativo === true);
            // Limita ao tamanho de página solicitado pelo usuário
            const clientesLimitados = clientesAtivos.slice(0, this.pageSize);
            this.clientesPJ.set(clientesLimitados);
            this.totalPages.set(response.totalPages);
            this.totalElements.set(response.totalElements);
            this.loading.set(false);
          }, remainingTime);
        },
        error: (err: any) => {
          this.error.set('Erro ao carregar clientes. Verifique se o servidor está rodando.');
          this.loading.set(false);
          console.error('Erro ao carregar clientes:', err);
        }
      });
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
}
