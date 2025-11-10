# 🔐 Credenciais de Teste - Yukam Front

> **⚠️ APENAS PARA DESENVOLVIMENTO E QA**
> Estas credenciais são para ambiente de desenvolvimento/teste. **NUNCA** use em produção!

---

## 🌐 URLs

- **Frontend:** http://localhost:4200
- **Backend (user-core):** http://localhost:8182
- **Login Page:** http://localhost:4200/login
- **Dashboard:** http://localhost:4200/dashboard

---

## 🔑 Senha Padrão

**Todas as contas usam a mesma senha:**

```
senha123
```

---

## 👥 Usuários de Teste por ROLE

### 🔴 ROLE_ADMIN (Acesso Total)

Administradores têm acesso irrestrito a **TODOS** os menus e funcionalidades.

| Login | Email | Roles | Descrição |
|-------|-------|-------|-----------|
| `root` | root@dev.local | ADMIN, ANALISTA, FUNCIONARIO, CLIENTE | Superusuário com todas as 4 roles |
| `ana.silva` | ana.silva@example.com | ADMIN, CLIENTE | Administrador + Cliente |

**Acesso permitido:**
- ✅ **Clientes** → Listar todos, Buscar por CPF/CNPJ, Buscar por UUID
- ✅ **Relatórios** → Todos os relatórios (Leads, etc.)
- ✅ **Financeiro** → Acesso completo
- ✅ **Configurações** → Reset de Senha

---

### 🟡 ROLE_ANALISTA (Visualização e Relatórios)

Analistas têm acesso a listagens completas, relatórios e dados financeiros.

| Login | Email | Roles | Descrição |
|-------|-------|-------|-----------|
| `analista.teste` | analista@teste.com | ANALISTA | Usuário criado para testes |

**Acesso permitido:**
- ✅ **Clientes** → Listar todos
- ✅ **Relatórios** → Todos os relatórios
- ✅ **Financeiro** → Acesso completo
- ❌ Buscar por CPF/CNPJ (bloqueado)
- ❌ Buscar por UUID (bloqueado)
- ❌ Reset de Senha (bloqueado)

---

### 🟢 ROLE_FUNCIONARIO (Operacional)

Funcionários têm acesso a buscas específicas e reset de senha.

| Login | Email | Roles | Descrição |
|-------|-------|-------|-----------|
| `funcionario.teste` | funcionario@teste.com | FUNCIONARIO | Usuário criado para testes |

**Acesso permitido:**
- ✅ **Clientes** → Buscar por CPF/CNPJ
- ✅ **Clientes** → Buscar por UUID
- ✅ **Configurações** → Reset de Senha
- ❌ Listar todos (bloqueado)
- ❌ Relatórios (bloqueado)
- ❌ Financeiro (bloqueado)

---

### 🔵 ROLE_CLIENTE (Sem Acesso ao Dashboard)

Clientes não têm acesso ao dashboard administrativo.

| Login | Email | Roles | Descrição |
|-------|-------|-------|-----------|
| `bruno.lima1004` | bruno.lima1004@email.com | CLIENTE | Cliente comum |
| `camila.rodrigues1005` | camila.rodrigues1005@email.com | CLIENTE | Cliente comum |
| `carla.mendes` | carla.mendes@email.com | CLIENTE | Cliente comum |

**Acesso:**
- ❌ **Sem acesso ao dashboard** - todas as categorias de menu ficam ocultas

---

## 🧪 Cenários de Teste

### ✅ Teste 1: ADMIN - Acesso Total
```
Login: root
Senha: senha123
Resultado Esperado: Ver TODOS os menus (Clientes, Relatórios, Financeiro, Configurações)
```

### ✅ Teste 2: ANALISTA - Visualização e Análise
```
Login: analista.teste
Senha: senha123
Resultado Esperado:
- ✅ Ver menu "Clientes" → apenas "Listar todos"
- ✅ Ver menu "Relatórios"
- ✅ Ver menu "Financeiro"
- ❌ NÃO ver "Buscar por CPF/CNPJ"
- ❌ NÃO ver "Buscar por UUID"
- ❌ NÃO ver menu "Configurações"
```

### ✅ Teste 3: FUNCIONARIO - Operacional
```
Login: funcionario.teste
Senha: senha123
Resultado Esperado:
- ✅ Ver menu "Clientes" → "Buscar por CPF/CNPJ" e "Buscar por UUID"
- ✅ Ver menu "Configurações" → "Reset de Senha"
- ❌ NÃO ver "Listar todos"
- ❌ NÃO ver menu "Relatórios"
- ❌ NÃO ver menu "Financeiro"
```

### ✅ Teste 4: CLIENTE - Sem Acesso
```
Login: bruno.lima1004
Senha: senha123
Resultado Esperado:
- ❌ Dashboard vazio (nenhum menu visível)
- ❌ Todas as categorias de menu ocultas
```

### ✅ Teste 5: Logout e Troca de Usuário
```
1. Login como: root
2. Verificar menus disponíveis (deve ver tudo)
3. Fazer logout
4. Login como: funcionario.teste
5. Verificar menus disponíveis (deve ver apenas buscas)
6. Verificar que o menu mudou corretamente
```

---

## 🔄 Fluxo de Teste Completo

### Passo a Passo para QA

1. **Limpar Sessão**
   - Abrir navegador em modo anônimo/privado OU
   - Limpar localStorage e cookies

2. **Teste com cada ROLE**
   - Login com cada credencial listada
   - Verificar menu lateral
   - Tentar acessar funcionalidades permitidas
   - Verificar que funcionalidades bloqueadas não aparecem

3. **Teste de Persistência**
   - Fazer login
   - Recarregar página (F5)
   - Verificar que continua autenticado
   - Verificar que menus permanecem corretos

4. **Teste de Logout**
   - Fazer logout
   - Verificar redirecionamento para /login
   - Tentar acessar /dashboard diretamente
   - Deve redirecionar para /login

---

## 🛠️ Troubleshooting

### Problema: "Login falhou" ou 401 Unauthorized

**Soluções:**
1. Verificar se o backend está rodando: `docker ps | grep user-core`
2. Verificar logs do backend: `docker logs user-core-app`
3. Testar endpoint diretamente:
   ```bash
   curl -X POST http://localhost:8182/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"login":"root","password":"senha123"}'
   ```

### Problema: Menu não muda após login

**Soluções:**
1. Limpar localStorage: `localStorage.clear()`
2. Fazer logout e login novamente
3. Verificar console do navegador (F12) por erros

### Problema: Usuário não encontrado

**Verificar no banco:**
```bash
docker exec -i user-core-postgres psql -U postgres -d user_core \
  -c "SELECT login, email, ARRAY_AGG(r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.login = 'root'
      GROUP BY u.login, u.email;"
```

---

## 📝 Notas para Desenvolvedores

### Adicionar Novo Usuário de Teste

```sql
-- Conectar ao banco
docker exec -i user-core-postgres psql -U postgres -d user_core

-- Inserir usuário
INSERT INTO users (public_id, login, email, password_hash, two_factor_enabled, theme, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'novo.usuario',
  'novo@teste.com',
  '$2a$10$uigYW7oG1Kp5r0L/2TUyreqhgpXzV6/w6JZWR/G.d6ZuaQnUlus9a',
  false,
  'LIGHT',
  NOW(),
  NOW()
);

-- Atribuir ROLE (exemplo: ANALISTA)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.name = 'ROLE_ANALISTA'
  AND u.login = 'novo.usuario';
```

### Hash da Senha "senha123"

```
$2a$10$uigYW7oG1Kp5r0L/2TUyreqhgpXzV6/w6JZWR/G.d6ZuaQnUlus9a
```

Para gerar um novo hash:
```bash
curl http://localhost:8182/api/auth/generate-hash/SUA_SENHA
```

---

## 📊 Matriz de Permissões

| Funcionalidade | ADMIN | ANALISTA | FUNCIONARIO | CLIENTE |
|----------------|-------|----------|-------------|---------|
| Listar Todos | ✅ | ✅ | ❌ | ❌ |
| Buscar CPF/CNPJ | ✅ | ❌ | ✅ | ❌ |
| Buscar UUID | ✅ | ❌ | ✅ | ❌ |
| Relatórios | ✅ | ✅ | ❌ | ❌ |
| Financeiro | ✅ | ✅ | ❌ | ❌ |
| Reset Senha | ✅ | ❌ | ✅ | ❌ |

---

## 🔒 Segurança

**⚠️ IMPORTANTE:**

1. **Estas credenciais são APENAS para DEV/QA**
2. **NUNCA commitar senhas reais no código**
3. **Em produção:**
   - Use senhas fortes
   - Implemente rate limiting
   - Force troca de senha no primeiro login
   - Considere 2FA (Two-Factor Authentication)
   - Use HTTPS sempre

---

**Última atualização:** 2025-11-10
**Versão do sistema:** 1.0.0
**Ambiente:** Desenvolvimento / QA
