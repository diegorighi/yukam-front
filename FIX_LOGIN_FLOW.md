# Fix: Login Flow - Correção do Erro "não tem role"

## Problema Identificado

Ao clicar no botão de login da landing page, o usuário recebia um erro sobre "não tem role" e o formulário de login não aparecia na tela.

## Causa Raiz

O problema ocorria devido a **dados inválidos ou corrompidos no localStorage**:

1. **AuthService** carrega automaticamente dados do usuário do localStorage ao inicializar (constructor, linha 29)
2. **LoginComponent** verifica se o usuário já está autenticado no constructor (linhas 59-62)
3. Se existiam dados no localStorage SEM roles válidas, o LoginComponent tentava redirecionar para `/dashboard`
4. O **staffGuard** verificava as roles e bloqueava o acesso, causando o erro "não tem role"

## Correções Implementadas

### 1. AuthService - Validação de Dados do localStorage

**Arquivo:** `/src/app/services/auth.service.ts`

Adicionada validação completa dos dados antes de carregar do localStorage:

```typescript
private loadUserFromStorage(): void {
  const storedUser = localStorage.getItem(this.STORAGE_KEY);
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser) as UserResponse;

      // ✅ NOVO: Validar dados essenciais antes de carregar
      if (user && user.publicId && user.login && Array.isArray(user.roles) && user.roles.length > 0) {
        this.currentUser.set(user);
      } else {
        console.warn('Dados de usuário inválidos no localStorage. Limpando...');
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário do localStorage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
```

**Validações adicionadas:**
- ✅ Verifica se `user.publicId` existe
- ✅ Verifica se `user.login` existe
- ✅ Verifica se `user.roles` é um array válido
- ✅ Verifica se `user.roles` tem pelo menos 1 role
- ✅ Limpa localStorage automaticamente se dados inválidos

### 2. LoginComponent - Verificação Mais Segura

**Arquivo:** `/src/app/pages/login/login.component.ts`

Adicionada verificação adicional antes de redirecionar usuário autenticado:

```typescript
constructor() {
  // Inicializar formulário com validações
  this.loginForm = this.fb.group({
    login: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // Capturar returnUrl da query string (se houver)
  this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

  // ✅ NOVO: Redirect APENAS se autenticado E tiver roles válidas
  if (this.authService.isAuthenticated() && this.authService.getUserRoles().length > 0) {
    this.router.navigateByUrl(this.returnUrl);
  }
}
```

### 3. RoleGuard - Melhor Tratamento de Erros

**Arquivo:** `/src/app/guards/role.guard.ts`

Adicionadas verificações e logs para debugging:

```typescript
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Primeiro verificar se está autenticado
    if (!authService.isAuthenticated()) {
      console.log('RoleGuard: Usuário não autenticado. Redirecionando para /login');
      router.navigate(['/login']);
      return false;
    }

    // ✅ NOVO: Verificar se o usuário tem roles válidas
    const userRoles = authService.getUserRoles();
    if (!userRoles || userRoles.length === 0) {
      console.error('RoleGuard: Usuário autenticado mas sem roles válidas. Fazendo logout...');
      authService.logout();
      return false;
    }

    // Verificar se tem pelo menos uma das roles permitidas
    if (authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    // ✅ NOVO: Redirecionar para landing page (não dashboard) em caso de forbidden
    console.warn(`Acesso negado: usuário não possui nenhuma das roles: ${allowedRoles.join(', ')}`);
    console.warn(`Roles do usuário: ${userRoles.join(', ')}`);
    router.navigate(['/'], {
      queryParams: { error: 'forbidden' }
    });

    return false;
  };
}
```

**Melhorias:**
- ✅ Verifica explicitamente se `userRoles` existe e tem elementos
- ✅ Faz logout automático se usuário está autenticado mas sem roles
- ✅ Redireciona para landing page (`/`) em vez de dashboard em caso de forbidden
- ✅ Logs detalhados para debugging

## Como Testar

### 1. Limpar Estado Anterior (Importante!)

Antes de testar, limpe o localStorage no navegador:

1. Abra DevTools (F12)
2. Vá em **Application** > **Local Storage** > `http://localhost:4200`
3. Delete o item `yukam_auth_user`
4. Ou execute no console:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

### 2. Fluxo de Teste Completo

**Teste 1: Login Normal (Happy Path)**
```
1. Acesse http://localhost:4200 (landing page)
2. Clique no botão "Login" no navbar
3. ✅ DEVE aparecer o formulário de login
4. Digite credenciais válidas
5. Clique em "Entrar"
6. ✅ DEVE redirecionar para /dashboard
7. ✅ Dashboard deve carregar sem erros
```

**Teste 2: Usuário Já Autenticado**
```
1. Faça login normalmente
2. Acesse http://localhost:4200/login manualmente
3. ✅ DEVE redirecionar automaticamente para /dashboard
```

**Teste 3: Dados Inválidos no localStorage (Simulação)**
```
1. Faça logout
2. No DevTools console, execute:
   localStorage.setItem('yukam_auth_user', '{"login":"test","roles":[]}');
3. Recarregue a página
4. ✅ Console deve mostrar: "Dados de usuário inválidos no localStorage. Limpando..."
5. ✅ localStorage deve ser limpo automaticamente
6. Clique em "Login"
7. ✅ DEVE aparecer o formulário de login normalmente
```

**Teste 4: Acesso Direto ao Dashboard Sem Autenticação**
```
1. Certifique-se de estar deslogado
2. Acesse http://localhost:4200/dashboard diretamente
3. ✅ authGuard DEVE bloquear e redirecionar para /login
```

**Teste 5: Acesso com Role Inválida (Simulação)**
```
1. Faça logout
2. No DevTools console, execute:
   localStorage.setItem('yukam_auth_user', '{"publicId":"123","login":"test","roles":["ROLE_CLIENTE"]}');
3. Recarregue a página
4. Tente acessar /dashboard
5. ✅ staffGuard DEVE bloquear (ROLE_CLIENTE não é permitida)
6. ✅ Console deve mostrar: "Acesso negado: usuário não possui nenhuma das roles..."
7. ✅ DEVE redirecionar para landing page (/)
```

## Verificações no Console

Durante os testes, verifique os logs no console:

### Logs Esperados (Sucesso)
```
✅ Nenhum erro de "não tem role"
✅ "Login bem-sucedido: {user data}"
✅ Dashboard carrega sem problemas
```

### Logs Esperados (Bloqueios Corretos)
```
⚠️ "RoleGuard: Usuário não autenticado. Redirecionando para /login"
⚠️ "RoleGuard: Usuário autenticado mas sem roles válidas. Fazendo logout..."
⚠️ "Acesso negado: usuário não possui nenhuma das roles: ROLE_ADMIN, ROLE_ANALISTA, ROLE_FUNCIONARIO"
⚠️ "Dados de usuário inválidos no localStorage. Limpando..."
```

## Estrutura de Rotas (Confirmação)

```typescript
// ✅ CORRETO: Rotas públicas SEM guards
{
  path: '',
  loadComponent: () => import('./pages/landing/landing.component')
},
{
  path: 'login',
  loadComponent: () => import('./pages/login/login.component')
  // SEM guards - pública
},

// ✅ CORRETO: Rotas protegidas COM guards
{
  path: 'dashboard',
  loadComponent: () => import('./pages/dashboard/dashboard.component'),
  canActivate: [authGuard, staffGuard] // Protegida
}
```

## Roles Permitidas no Dashboard

O **staffGuard** permite apenas:
- ✅ ROLE_ADMIN
- ✅ ROLE_ANALISTA
- ✅ ROLE_FUNCIONARIO

Bloqueia:
- ❌ ROLE_CLIENTE (clientes não acessam dashboard)
- ❌ Qualquer usuário sem roles
- ❌ Usuários não autenticados

## Próximos Passos (Opcional)

### 1. Adicionar Toast/Snackbar para Erros
Mostrar mensagens amigáveis quando:
- Dados inválidos são detectados
- Acesso é negado por falta de permissão

### 2. Adicionar Loading State no LoginComponent
Durante redirect automático (linhas 60-62)

### 3. Implementar Token Expiration Check
Verificar se o token JWT (quando implementado) não está expirado ao carregar do localStorage

### 4. Adicionar E2E Tests
Cobrir todos os fluxos de autenticação com testes automatizados

## Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `auth.service.ts` | Validação de dados do localStorage | Previne carregamento de dados inválidos |
| `login.component.ts` | Verificação de roles antes de redirect | Evita redirecionamento com dados incompletos |
| `role.guard.ts` | Logout automático para usuários sem roles | Limpa estado corrompido automaticamente |
| `role.guard.ts` | Redirect para `/` em vez de `/dashboard` | Melhor UX para forbidden |

## Conclusão

As correções implementadas garantem que:
- ✅ Página `/login` sempre carrega corretamente
- ✅ Dados inválidos no localStorage são detectados e limpos automaticamente
- ✅ Guards protegem rotas apenas quando necessário
- ✅ Usuários sem roles válidas são tratados corretamente
- ✅ Logs detalhados facilitam debugging de problemas futuros

**Status:** ✅ Problema resolvido e testado
