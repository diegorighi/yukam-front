# Relatórios de Leads - Documentação

## Visão Geral

O sistema de Relatórios de Leads é uma funcionalidade do Dashboard que permite visualizar e analisar a origem dos leads (clientes potenciais) no sistema Yukam. A funcionalidade está completamente implementada e operacional desde a versão MVP.

**Localização:** Dashboard → Relatórios → Leads

**Status:** ✅ Implementado e funcional

---

## Estrutura de Dados

### Interface LeadSource

Definida em `src/app/pages/dashboard/dashboard.component.ts:31-36`

```typescript
interface LeadSource {
  label: string;      // Nome amigável da fonte (ex: "Google Ads")
  value: number;      // Quantidade de leads desta fonte
  percentage: number; // Percentual sobre o total
  color: string;      // Cor hexadecimal para o gráfico
}
```

### Origem do Lead nos Modelos de Cliente

Tanto `ClientePF` (Pessoa Física) quanto `ClientePJ` (Pessoa Jurídica) possuem o campo:

```typescript
origemLead?: string;  // Código da fonte de origem do lead
```

**Arquivo:** `src/app/models/cliente.model.ts`

---

## Fontes de Leads Suportadas

O sistema suporta 12 fontes de leads diferentes, cada uma com cor e identificação próprias:

| Código | Label | Cor | Descrição |
|--------|-------|-----|-----------|
| `GOOGLE_ADS` | Google Ads | #2563EB (Azul) | Campanhas de anúncios do Google |
| `INSTAGRAM` | Instagram | #DB2777 (Rosa) | Marketing no Instagram |
| `FACEBOOK` | Facebook | #1E40AF (Azul Escuro) | Anúncios e páginas do Facebook |
| `LINKEDIN` | LinkedIn | #0284C7 (Ciano) | Networking profissional |
| `ORGANICO` | Orgânico (SEO) | #059669 (Verde) | Busca orgânica e SEO |
| `INDICACAO` | Indicação | #D97706 (Laranja) | Indicações de clientes |
| `YOUTUBE` | YouTube | #DC2626 (Vermelho) | Vídeos e anúncios no YouTube |
| `TWITTER` | Twitter | #0EA5E9 (Azul Twitter) | Campanhas no Twitter/X |
| `TIKTOK` | TikTok | #C026D3 (Magenta) | Marketing no TikTok |
| `EMAIL_MARKETING` | Email Marketing | #EA580C (Laranja) | Campanhas de email |
| `WHATSAPP` | WhatsApp | #16A34A (Verde) | Contatos via WhatsApp |
| `OUTROS` | Outros | #7C3AED (Roxo) | Outras fontes não especificadas |

**Implementação:** `dashboard.component.ts:902-931`

---

## Funcionalidades Implementadas

### 1. Carregamento de Dados

**Método:** `loadLeadsData()` (linhas 854-884)

```typescript
async loadLeadsData(): Promise<void>
```

**Funcionamento:**
- Carrega todos os clientes ativos (PF + PJ) via serviços HTTP
- Combina os dados em uma lista unificada
- Processa os dados através de `processLeadsData()`
- Inicializa o gráfico de visualização
- Gerencia estados de loading e erro

### 2. Processamento de Dados

**Método:** `processLeadsData(clientes: any[])` (linhas 887-942)

**Funcionamento:**
- Agrupa clientes por `origemLead`
- Conta o total de leads por fonte
- Mapeia códigos para labels e cores amigáveis
- Calcula percentuais de cada fonte
- Ordena por quantidade (maior → menor)

### 3. Visualização em Gráfico

**Método:** `initLeadsChart()` (linhas 945-1069)

**Tipo de Gráfico:** Donut Chart (ApexCharts)

**Características:**
- Gráfico responsivo e interativo
- Animação suave de entrada
- Tooltips customizados com percentuais
- Legendas com cores e valores
- Suporte a temas claro/escuro
- Adaptação para dispositivos móveis

**Configuração:**
```typescript
{
  chart: {
    type: 'donut',
    height: 350,
    animations: { enabled: true, speed: 800 }
  },
  series: [valores],
  labels: [nomes das fontes],
  colors: [cores por fonte]
}
```

### 4. Estatísticas Calculadas

#### Total de Leads
**Método:** `getTotalLeads()` (linhas 1072-1074)

Retorna a soma de todos os leads de todas as fontes.

#### Principal Origem
**Método:** `getTopLeadSource()` (linhas 1077-1083)

Retorna o nome da fonte com maior número de leads.

#### Taxa de Conversão Média
**Método:** `getAverageConversion()` (linhas 1086-1089)

```typescript
// AIDEV-NOTE AI: TODO
// TODO: Implementar cálculo real quando houver dados de conversão
return '24.5'; // Mock data temporário
```

⚠️ **PENDENTE:** Aguardando implementação de dados de conversão no backend.

---

## Interface do Usuário

### Localização no Menu

**Arquivo:** `dashboard.component.html:136-149`

```html
<div class="menu-section">
  <div class="section-header">
    <span class="section-icon">📊</span>
    <span>Relatórios</span>
  </div>
  <button
    class="menu-item"
    [class.active]="activeAction === 'reportLeads'"
    (click)="setActiveAction('reportLeads')">
    <span class="icon">📈</span>
    <span class="item-text">Leads</span>
  </button>
  <!-- Outros relatórios (desabilitados) -->
</div>
```

### Estrutura da Tela

**Arquivo:** `dashboard.component.html:608-689`

**Componentes:**
1. **Header**
   - Título: "Relatório de Leads"
   - Subtítulo: "Origem dos leads por fonte de aquisição"

2. **Loading State**
   - Componente `<app-loading>` com mensagem personalizada
   - Exibido enquanto dados são carregados

3. **Chart Card**
   - Gráfico donut principal
   - Legenda interativa com todas as fontes
   - Título: "Distribuição de Leads por Origem"

4. **Stats Grid (3 cards)**
   - **Total de Leads:** Soma total de todos os leads
   - **Principal Origem:** Fonte com mais leads
   - **Fontes Distintas:** Quantidade de fontes diferentes

5. **Empty State**
   - Mensagem: "Nenhum lead encontrado"
   - Exibido quando não há dados

---

## Tipos de Relatórios Definidos

**Arquivo:** `dashboard.component.ts:11-29`

```typescript
type ActionType =
  | 'reportLeads'                 // ✅ IMPLEMENTADO
  | 'reportClientesPorRegiao'     // 🔜 Futuro
  | 'reportTopVendedores'         // 🔜 Futuro
  | 'reportTopCompradores'        // 🔜 Futuro
  | 'reportClientesBloqueados'    // 🔜 Futuro
  | 'reportNovosClientes'         // 🔜 Futuro
  | 'reportFaixaEtaria'           // 🔜 Futuro
  | 'reportPorTipoCliente'        // 🔜 Futuro
  | 'reportEstadoCivil'           // 🔜 Futuro
  | 'reportVolumeVendas'          // 🔜 Futuro
  | 'reportOrigemLead'            // 🔜 Futuro
  | 'reportPFvsPJ'                // 🔜 Futuro
  // ... outros
```

### Status dos Relatórios

- ✅ **Leads:** Totalmente implementado e funcional
- 🔜 **Outros 11 relatórios:** Estrutura criada, aguardando implementação
  - Menu items marcados com `class="disabled"`
  - Tooltip: "Funcionalidade futura"

---

## Fluxo de Dados

```
1. Usuário clica em "Relatórios > Leads"
        ↓
2. setActiveAction('reportLeads') é chamado
        ↓
3. loadLeadsData() é executado
        ↓
4. Serviços HTTP carregam clientes PF e PJ
        ↓
5. processLeadsData() agrupa por origemLead
        ↓
6. Dados processados → leadsData: LeadSource[]
        ↓
7. initLeadsChart() cria visualização ApexCharts
        ↓
8. Estatísticas são calculadas e exibidas
        ↓
9. Interface completa é renderizada
```

---

## Tratamento de Erros

### Cenários Cobertos

1. **Erro ao carregar dados**
   ```typescript
   catch (error) {
     console.error('Erro ao carregar dados de leads:', error);
     this.message.set({
       type: 'error',
       text: 'Erro ao carregar relatório de leads'
     });
   }
   ```

2. **Sem dados disponíveis**
   - Exibe mensagem: "Nenhum lead encontrado"
   - Não tenta renderizar gráfico vazio

3. **Cliente sem origemLead definido**
   - Ignorado no processamento
   - Não contabilizado nas estatísticas

---

## Responsividade

### Breakpoints

**Desktop (> 768px):**
- Gráfico: 350px de altura
- Stats Grid: 3 colunas
- Chart card: largura completa

**Mobile (≤ 768px):**
- Gráfico reduzido automaticamente
- Stats Grid: 1 coluna empilhada
- Fonte de texto ajustada

**Implementação:** CSS flexbox + media queries no `dashboard.component.css`

---

## Dependências

### Bibliotecas Externas

- **ApexCharts** (`ng-apexcharts`)
  - Versão: Angular wrapper do ApexCharts
  - Uso: Renderização do gráfico donut
  - Docs: https://apexcharts.com/

### Componentes Internos

- `<app-loading>`: Componente de loading reutilizável
- `ThemeService`: Gerenciamento de tema claro/escuro

---

## TODOs e Melhorias Futuras

### Implementações Pendentes

1. **Taxa de Conversão Real** (Prioridade: Alta)
   ```typescript
   // Linha 1087
   // TODO: Implementar cálculo real quando houver dados de conversão
   ```
   - Requer endpoint no backend para dados de conversão
   - Cálculo: (Clientes convertidos / Total de leads) × 100

2. **Filtro por Período** (Prioridade: Média)
   - Adicionar seletor de data range
   - Filtrar leads por `dataCriacao`

3. **Exportação de Dados** (Prioridade: Baixa)
   - Botão para exportar CSV/PDF
   - Incluir gráfico e estatísticas

4. **Drill-down por Fonte** (Prioridade: Média)
   - Clicar na fonte → listar clientes daquela origem
   - Modal ou navegação para lista filtrada

5. **Comparação de Períodos** (Prioridade: Baixa)
   - Comparar mês atual vs mês anterior
   - Indicadores de crescimento/queda

### Outros Relatórios a Implementar

- Clientes por Região (geolocalização)
- Top Vendedores/Compradores
- Clientes Bloqueados (análise de motivos)
- Novos Clientes (tendência temporal)
- Faixa Etária (demografia)
- PF vs PJ (proporção de tipos)
- Volume de Vendas (financeiro)
- Estado Civil (segmentação)

---

## Referências de Código

### Principais Arquivos

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `dashboard.component.ts` | 11-29 | Type definitions de ActionType |
| `dashboard.component.ts` | 31-36 | Interface LeadSource |
| `dashboard.component.ts` | 854-1089 | Implementação completa de leads |
| `dashboard.component.html` | 136-149 | Menu de relatórios |
| `dashboard.component.html` | 608-689 | Template do relatório de leads |
| `cliente.model.ts` | 25 (PF), 52 (PJ) | Campo origemLead |

### Métodos Chave

```typescript
// Carregamento e inicialização
loadLeadsData(): Promise<void>           // linha 854
processLeadsData(clientes: any[]): void  // linha 887
initLeadsChart(): void                   // linha 945

// Estatísticas
getTotalLeads(): number                  // linha 1072
getTopLeadSource(): string               // linha 1077
getAverageConversion(): string           // linha 1086 (mock)
```

---

## Notas para Desenvolvedores

### Adicionando Nova Fonte de Lead

1. Adicionar código em `colorMap` e `labelMap` (linhas 902-931)
2. Definir cor única (formato hexadecimal)
3. O processamento é automático se o backend enviar o código

### Modificando o Gráfico

O gráfico usa ApexCharts com configuração em `initLeadsChart()`. Principais pontos de customização:

- **Cores:** Array `colors` na configuração
- **Labels:** Array `labels` com nomes das fontes
- **Altura:** Propriedade `chart.height`
- **Tipo:** Alterar `chart.type` (donut, pie, bar, etc.)

### Debugging

```typescript
// Adicionar logs no processamento
console.log('Leads processados:', this.leadsData);
console.log('Total de leads:', this.getTotalLeads());
console.log('Fonte principal:', this.getTopLeadSource());
```

---

## Changelog

### Versão MVP (atual)
- ✅ Implementação completa do relatório de leads
- ✅ Gráfico donut interativo
- ✅ 12 fontes de leads mapeadas
- ✅ Estatísticas básicas (total, top source, distinct sources)
- ✅ UI responsiva e loading states
- ⚠️ Taxa de conversão com dados mock (TODO)

### Próximas Versões (planejado)
- 🔜 Implementar 11 relatórios adicionais
- 🔜 Filtros por período
- 🔜 Exportação de dados
- 🔜 Taxa de conversão real

---

**Última atualização:** 2025-11-09
**Desenvolvido por:** Yukam Team
**Framework:** Angular 18 + TypeScript
