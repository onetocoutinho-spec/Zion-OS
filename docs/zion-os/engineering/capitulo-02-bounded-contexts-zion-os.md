# Capítulo 02 — Bounded Contexts do Zion OS

> **Natureza.** Descoberta dos **limites naturais do domínio**, derivada exclusivamente das
> cinco investigações anteriores. **Não impõe arquitetura** — descobre a que já está
> implícita no comportamento do negócio. Onde um critério de contexto não pôde ser
> demonstrado: **EVIDÊNCIA INSUFICIENTE**.
>
> **Fonte primária:** Diagnóstico Arquitetural · Validação da Fundação · Plano de
> Convergência · Análise Comparativa do Modelo de Domínio · Modelo Funcional Canônico
> (Capítulo 01). `HEAD d2b0fe5`.

---

## 1. Objetivo

Responder a uma única pergunta:

> **Quais partes do negócio possuem modelos próprios e podem evoluir independentemente?**

## 2. Metodologia

Um Bounded Context só é declarado quando os **cinco critérios** são demonstráveis por
evidência: linguagem própria, responsabilidade própria, modelo próprio, ciclo de vida
próprio, e **mudanças internas que tendem a permanecer internas**. Falhando qualquer um:
**EVIDÊNCIA INSUFICIENTE** — nenhum contexto é criado por conveniência.

**Nenhuma pasta, módulo ou namespace é usado como argumento.** A coincidência entre os
contextos aqui descobertos e os módulos criados na refatoração (`integration`, `publication`,
`catalog`) é **consequência**, não premissa — ambos derivam do mesmo comportamento.

## 3. Evidências utilizadas

| Documento | O que fornece a esta missão |
|---|---|
| Modelo Funcional (Cap. 01) | 16 capacidades, cadeia de valor, dois personas, o núcleo (Esteira A1→A10) |
| Análise de Domínio | Divergência `Produto` × `ProdutoMestre`; variação em 3 recortes; ML clássico × User Products |
| Diagnóstico | Hubs, integrações (ML, Supabase, IA), fronteiras de execução |
| Validação da Fundação | Conceitos canônicos (agregados, VOs) e seu não-uso |
| Plano de Convergência | Regras de negócio dos VOs (EAN, Dinheiro, SKU) |

---

## 4. Conceitos identificados

Extraídos dos cinco documentos, sem assumir corretude prévia:

| Conceito | Origem da evidência |
|---|---|
| **Produto** (registro) | Cap. 01 C1; Análise de Domínio |
| **Anúncio Gerado** (saída da IA) | Cap. 01 C2; schema `AnuncioGerado` |
| **Anúncio publicado** (entidade do ML) | Cap. 01 C9, C10 |
| **Esteira** (pipeline A1→A10) | Cap. 01 C2 |
| **Agente** (unidade configurável da IA) | Cap. 01 C12 |
| **Veredito de qualidade** (A10) | Cap. 01 C2 |
| **Publicação** (clássico × User Products) | Cap. 01 C9; Análise de Domínio |
| **Guia de tamanhos** (calçado) | Cap. 01 C5, C9 |
| **Canal / Conexão** | Cap. 01 C8 |
| **Preço / Precificação** | Cap. 01 C4 |
| **Imagem** | Cap. 01 C6 |
| **Medidas** (por marca) | Cap. 01 C5 |
| **Auditoria / Pendência** | Cap. 01 C7 |
| **Venda / Pedido** | Cap. 01 C11 |
| **Cliente** (atendido) | Cap. 01 C13, C14 |
| **Agência / Usuário** | Cap. 01 C14 |
| **SKU · EAN · Dinheiro** (valores) | Plano de Convergência |
| **Variante** (3 recortes) | Análise de Domínio; Cap. 01 S1 |

---

## 5. Linguagem do negócio — onde os termos mudam de significado

O sinal mais forte de fronteira de contexto é **um termo que muda de sentido conforme o
fluxo**. Três foram encontrados:

### 5.1 "Anúncio" — três significados

| Significado | Onde | Natureza |
|---|---|---|
| **Anúncio Gerado** | saída da Esteira, antes de publicar | rascunho de IA, com veredito |
| **Anúncio publicado** | no Mercado Livre | entidade externa, autoridade do ML |
| **Anúncio Variante** | no recorte de variação | uma linha de variação |

**Conclusão:** "Anúncio" cruza pelo menos **duas fronteiras** — o que a IA produz e o que o
canal publica são coisas diferentes, com donos diferentes.

### 5.2 "Produto" — dois modelos (já estabelecido)

`Produto` (item de publicação, plano, marketplace acoplado) × `ProdutoMestre` (catálogo
canônico versionado). Estabelecido na Análise de Domínio como **DOMÍNIO ALTERNATIVO** —
escopos distintos, não maturidades do mesmo.

### 5.3 "Cliente" — dois papéis

| Significado | Onde |
|---|---|
| **Cliente que opera** (persona do portal) | `/cliente/*` — usuário self-service |
| **Cliente atendido** (registro gerido) | `/clientes` — administrado pela agência |

**EVIDÊNCIA INSUFICIENTE** para afirmar que são **modelos** distintos (vs o mesmo registro
visto por dois papéis) — a distinção observada é de **persona**, não necessariamente de
modelo.

---

## 6. Modelos encontrados (PASSO 5)

| Conceito | Mais de um modelo? | Descrição |
|---|---|---|
| **Produto** | **SIM** | Publicação (`Produto`) × Catálogo (`ProdutoMestre`) — escopos diferentes |
| **Anúncio** | **SIM** | Gerado pela IA (rascunho) × Publicado no ML (externo) |
| **Publicação** | **UM modelo, dois formatos** | Clássico (`title`) × User Products (`family_name` + guia) — a categoria decide |
| **Cliente** | **EVIDÊNCIA INSUFICIENTE** | Dois papéis observados; um ou dois modelos não determinável |
| **Variante** | **SIM** | Três recortes: produto, anúncio, precificação |

---

## 7. Contextos identificados

Somente os que satisfazem os cinco critérios, cada um com justificativa citando evidência.

### BC1 — Catálogo de Produto
- **Responsabilidade:** manter o produto como registro — cadastro, importação, atributos, variantes, custo e **medidas por marca**.
- **Objetivo:** ter a base sobre a qual todo o resto opera.
- **Conceitos internos:** Produto, Variante, SKU, EAN, custo, marca, categoria, medidas.
- **Linguagem própria:** "produto", "variante", "medida por marca".
- **Ciclo de vida próprio:** criado/importado → atualizado. Independe de haver anúncio.
- **Eventos:** *produto cadastrado*, *produto importado*, *custo atualizado*.
- **Justificativa:** Cap. 01 C1, C5; Análise de Domínio (modelo `Produto`); R10 (medidas) migrada para `catalog`. Mudanças de cadastro **permanecem no catálogo** — não forçam republicação.

### BC2 — Geração de Conteúdo (Esteira de IA) — **NÚCLEO**
- **Responsabilidade:** transformar um produto cru em Anúncio Gerado, com portão de qualidade.
- **Objetivo:** produzir conteúdo de anúncio de qualidade sem trabalho manual especializado.
- **Conceitos internos:** Esteira, Agente (A1–A10), Anúncio Gerado, nota diagnóstica, título otimizado, palavras-chave, descrição, ficha técnica, FAQ, **veredito A10**.
- **Linguagem própria:** "esteira", "agente", "veredito", "aprovado/reprovado".
- **Ciclo de vida próprio:** gerado → aprovado | reprovado.
- **Eventos:** *anúncio gerado*, *veredito emitido*.
- **Justificativa:** Cap. 01 C2/C3/C12, declarado o **diferencial** do produto. O veredito A10 é interno a este contexto (é o último agente). Mudanças nos agentes **permanecem aqui** — não afetam publicação nem catálogo.

### BC3 — Precificação
- **Responsabilidade:** determinar preço a partir de custo, margem e confiança.
- **Conceitos internos:** custo, preço de venda, preço mínimo, margem, confiança do custo.
- **Linguagem própria:** "margem", "confiança do custo", "preço mínimo".
- **Ciclo de vida próprio:** preço muda **sem** regenerar conteúdo nem republicar.
- **Eventos:** *preço definido*, *custo importado*.
- **Justificativa:** Cap. 01 C4; tela e serviço próprios.
- **Interpretação alternativa registrada:** pode ser uma **faceta de BC1** (o preço vive no produto). A favor de contexto próprio: linguagem e ciclo independentes. A favor de faceta: o dado reside no `Produto`. **Ambas registradas; não decidida sem mais evidência.**

### BC4 — Conexão de Canal
- **Responsabilidade:** custodiar o vínculo entre cliente e marketplace — OAuth, token, seller.
- **Conceitos internos:** canal, refresh_token, seller, estado da conexão.
- **Linguagem própria:** "conectar", "canal válido/inválido", "token rotacionado".
- **Ciclo de vida próprio:** *Configurada → Válida → Inválida → Revalidada → Encerrada* (estados registrados na arquitetura do módulo Integration).
- **Eventos:** *canal conectado*, *token rotacionado*, *conexão invalidada*.
- **Justificativa:** Cap. 01 C8; R1 e R2 (R2 migrada para `integration/infrastructure`). O `refresh_token` nunca cruza o navegador — invariante próprio. Mudanças de conexão **não afetam** conteúdo nem catálogo.

### BC5 — Publicação no Canal — **HUB DE CONVERGÊNCIA**
- **Responsabilidade:** traduzir o anúncio para o formato do canal e publicá-lo; criar/reutilizar a guia de tamanhos.
- **Conceitos internos:** publicação, dry-run, User Products, family_name, guia de tamanhos, categoria, tipo de anúncio.
- **Linguagem própria:** "publicar", "dry-run", "User Products", "guia de tamanhos".
- **Ciclo de vida próprio:** dry-run → publicado. **As regras seguem o Mercado Livre**, não o Zion.
- **Eventos:** *guia criada/reutilizada*, *anúncio publicado*.
- **Justificativa:** Cap. 01 C9; R7, R11, R12, R13 (migradas para `integration`/`publication`); Blueprint de idempotência. Muda quando **o ML muda** — ciclo dirigido por autoridade externa.

### BC6 — Vendas do Canal
- **Responsabilidade:** ler as vendas do marketplace para dentro do Zion.
- **Conceitos internos:** venda, pedido *(referenciado, não modelado)*.
- **Linguagem própria:** "vendas do canal".
- **Ciclo de vida próprio:** somente leitura, dirigido pelo ML.
- **Eventos:** *venda lida*.
- **Justificativa:** Cap. 01 C11; R5.
- **Ressalva:** R5 está no **Grupo D — sem destino arquitetural** ("domínio Vendas/Pedidos referenciado, não especificado"). O contexto **existe por comportamento** (há a capacidade), mas seu **modelo interno é EVIDÊNCIA INSUFICIENTE**.

### BC7 — Identidade, Acesso e Clientes
- **Responsabilidade:** gerir clientes atendidos, usuários e autorização (multi-tenant).
- **Conceitos internos:** cliente, usuário, papel, organização, autorização.
- **Linguagem própria:** "cliente", "papel", "organização", "acesso ao cliente".
- **Ciclo de vida próprio:** cadastro de cliente/usuário, independente do fluxo de anúncio.
- **Eventos:** *cliente cadastrado*, *usuário convidado*.
- **Justificativa:** Cap. 01 C14; R16 (autorização, com linha de base própria); migrações de multi-tenancy (016, 017).
- **Ressalva:** R16 está no **Grupo D** — o módulo `identity-access` **não existe**. Contexto real por comportamento; destino arquitetural ausente.

---

## 7.1 Regiões que **não** são contextos — registradas com motivo

| Região | Por que não é um contexto |
|---|---|
| **Portal do Cliente** | É uma **superfície de entrega** (composição de UI sobre BC1–BC7), não um domínio com modelo próprio. Não tem linguagem nem ciclo de vida próprios — só reapresenta os outros |
| **Agência** | É um **papel organizacional**, parte de BC7 — não um modelo separado |
| **Imagem** | **EVIDÊNCIA INSUFICIENTE.** Duas interpretações: *(a)* faceta de BC2 (a Esteira produz `imagensSugeridas`); *(b)* contexto próprio (há `/cliente/imagens` e rota `imagens/gerar` autônomas). Não decidida sem evidência de ciclo de vida próprio da imagem |
| **Auditoria / Qualidade** | **EVIDÊNCIA INSUFICIENTE.** O veredito A10 é **interno a BC2**; a auditoria de base (`auditoriaDaBase`) atravessa BC1. Não se demonstrou um ciclo de vida próprio que a torne contexto autônomo |
| **Variante** | **Não é contexto — é um conceito que atravessa fronteiras** (produto, anúncio, preço). Sua fragmentação em 3 recortes é um fato registrado, não um contexto |

---

## 8. Eventos

Eventos observáveis, relacionados ao contexto que os **produz**:

| Evento | Contexto produtor | Contexto(s) consumidor(es) |
|---|---|---|
| Produto cadastrado / importado | BC1 Catálogo | BC2, BC3 |
| Custo atualizado | BC1 / BC3 | BC3 |
| Anúncio gerado | BC2 Esteira | BC5 |
| Veredito emitido (A10) | BC2 Esteira | BC5 (portão), BC7 (pendência) |
| Preço definido | BC3 Precificação | BC5 |
| Canal conectado | BC4 Conexão | BC5, BC6 |
| Token rotacionado | BC4 Conexão | — (interno) |
| Guia de tamanhos criada/reutilizada | BC5 Publicação | — (interno) |
| Anúncio publicado | BC5 Publicação | BC6 (implícito), relatórios |
| Venda lida | BC6 Vendas | relatórios |
| Cliente/usuário cadastrado | BC7 Identidade | todos (cross-cutting) |

> **Registro factual:** estes eventos são **observáveis no comportamento** (uma tela/rota os
> dispara). **Não** existe hoje um barramento de eventos que os publique explicitamente — o
> acoplamento é por chamada direta. Os "eventos de domínio" da Fundação (Cap. Validação)
> **não** estão ligados a este fluxo.

---

## 9. Dependências

| Contexto | Depende de | Produz para | Papel |
|---|---|---|---|
| **BC1 Catálogo** | — | BC2, BC3, BC5 | **Produtor de base** |
| **BC2 Esteira** | BC1 | BC5 | **Transformador** (núcleo) |
| **BC3 Precificação** | BC1 | BC5 | Preparador |
| **BC4 Conexão** | BC7 (cliente) | BC5, BC6 | Habilitador |
| **BC5 Publicação** | BC2, BC3, BC4, BC1 (medidas) | BC6, relatórios | **Convergência / publicador** |
| **BC6 Vendas** | BC4 | relatórios | **Observador** (read-only) |
| **BC7 Identidade** | — | todos | **Transversal** |

**Direção dominante:** `BC1 → BC2/BC3 → BC5 → BC6`. **BC5 é o hub de fan-in** (recebe de
quatro contextos) — o que corresponde à evidência de que R14 (orquestração em
`publicar/route.ts`) *"depende de 7 responsabilidades"*. **BC7 é transversal.**

---

## 10. Context Map

```
                          ┌─────────────────────────┐
        ┌──────────────►  │   BC7 IDENTIDADE/ACESSO │ ◄────── transversal a todos
        │                 └─────────────────────────┘
        │
 ┌──────────────┐  produto   ┌──────────────┐  anúncio gerado
 │ BC1 CATÁLOGO │ ─────────► │ BC2 ESTEIRA  │ ───────────────┐
 │  (produtor)  │ ──┐        │  (núcleo)    │                │
 └──────────────┘   │        └──────────────┘                ▼
        │           │ produto                          ┌───────────────┐
        │ medidas   └───────► ┌──────────────┐  preço  │ BC5 PUBLICAÇÃO│  anúncio
        └───────────────────► │BC3 PRECIFICAÇ│ ──────► │  (convergência│ ─publicado─► ML
                              └──────────────┘         │   / publicador│
                              ┌──────────────┐  canal  │               │
                              │ BC4 CONEXÃO  │ ──────► │               │
                              └──────────────┘         └───────┬───────┘
                                     │ canal                   │ anúncio publicado
                                     ▼                         ▼
                              ┌──────────────┐         ┌───────────────┐
                              │ BC6 VENDAS   │ ◄────── │  Mercado Livre│
                              │ (observador) │  vendas └───────────────┘
                              └──────────────┘
```

- **Quem inicia:** BC1 (produto entra).
- **Quem transforma:** BC2 (Esteira gera o anúncio) — o núcleo.
- **Quem publica:** BC5 (converge tudo e publica).
- **Quem monitora:** BC6 (lê vendas), relatórios.
- **Quem observa/atravessa:** BC7 (identidade/acesso).

---

## 11. Validação

| Contexto | Evolui sozinho? | Linguagem própria? | Regras próprias? | Ciclo próprio? | Veredito |
|---|---|---|---|---|---|
| BC1 Catálogo | Sim | Sim | Sim (validação de produto) | Sim | **Válido** |
| BC2 Esteira | Sim | Sim (agentes/veredito) | Sim (checklist A10) | Sim | **Válido** |
| BC3 Precificação | Parcial | Sim | Sim (margem/confiança) | Sim | **Válido, com alternativa** (faceta de BC1) |
| BC4 Conexão | Sim | Sim | Sim (token server-only) | Sim (estados) | **Válido** |
| BC5 Publicação | Sim | Sim (User Products) | Sim (regras do ML) | Sim | **Válido** |
| BC6 Vendas | Sim | Parcial | EVIDÊNCIA INSUF. | Sim (read-only) | **Válido por comportamento; modelo insuf.** |
| BC7 Identidade | Sim | Sim | Sim (autorização) | Sim | **Válido; sem módulo** |

**Sete contextos passam na validação por comportamento.** Dois (BC6, BC7) existem por
capacidade mas têm **destino arquitetural ausente** (Grupo D) — o que **confirma**, não
contradiz, sua natureza de contexto: são regiões de negócio reais ainda não modeladas.

---

## 12. Backlog de evolução — um Epic por contexto

Cada Epic descreve como o contexto pode **tornar-se explícito e evoluível**, sem reescrita.
Vários já estão parcialmente realizados pelos módulos da refatoração.

### EPIC-BC1 — Consolidar o Catálogo de Produto
- **Problema:** conceito de produto e suas validações dispersos; VOs de valor (EAN/SKU) não usados.
- **Benefício:** base de produto com linguagem e validação próprias.
- **Dependências:** nenhuma (é produtor).
- **Riscos:** validação aditiva não pode virar bloqueio.
- **Critérios de aceitação:** EAN/SKU validáveis de forma aditiva; comportamento de publicação inalterado.

### EPIC-BC2 — Explicitar o contexto Esteira
- **Problema:** o núcleo do produto não tem fronteira declarada.
- **Benefício:** o diferencial (IA + veredito) evolui isolado.
- **Dependências:** BC1.
- **Riscos:** baixo — é consolidação de documentação e fronteira, não de lógica.

### EPIC-BC5 — Formalizar Publicação como hub
- **Problema:** a orquestração (R14) concentra 7 responsabilidades e está bloqueada por governança.
- **Benefício:** o publicador converge insumos com fronteira clara.
- **Dependências:** BC2, BC3, BC4, BC1; **e a validação operacional do Grupo C**.
- **Riscos:** alto — toca `mercadolivre.ts`, bloqueado.

### EPIC-BC4 — Conexão de Canal como contexto isolado
- **Problema:** já quase pronto (R2 em `infrastructure`); falta declarar a fronteira.
- **Benefício:** custódia de canal evolui sozinha.
- **Dependências:** BC7.
- **Riscos:** baixo — R2 já migrada.

### EPIC-BC6 — Especificar Vendas/Pedidos
- **Problema:** contexto existe por capacidade; **modelo ausente** (R5, Grupo D).
- **Benefício:** vendas com modelo próprio.
- **Dependências:** BC4.
- **Riscos:** exige **especificação de domínio** — não é engenharia direta.
- **Necessita implementação?** **NÃO** nesta fase — precede uma missão de especificação.

### EPIC-BC7 — Especificar Identity & Access
- **Problema:** contexto real, módulo inexistente (R16, Grupo D).
- **Benefício:** identidade/acesso com fronteira própria.
- **Dependências:** —.
- **Riscos:** exige **especificação de arquitetura de módulo**.
- **Necessita implementação?** **NÃO** nesta fase — precede especificação.

### EPIC-BC3 — Resolver Precificação (contexto ou faceta)
- **Problema:** ambiguidade registrada (contexto próprio × faceta de BC1).
- **Necessita implementação?** **NÃO** — é uma **decisão de modelagem**, precede missão de descoberta.

---

## 13. Releases propostas

**Somente Epics com passo executável, não-behavior-changing, reversível.** As demais são
decisões ou especificações, marcadas acima.

### R-BC1.1 — Adotar `Ean`/`SkuOrigem` de forma aditiva *(= R-B5/B6 do Cap. 01)*
- **Objetivo:** validação/normalização de valor no Catálogo, **sem rejeitar** o que hoje é aceito.
- **Escopo:** um ponto de entrada + os VOs.
- **Aceitação:** inválido é **sinalizado**, não bloqueado; suíte verde.
- **Rollback:** remover o import.
- **Estimativa:** **Média** (Ean), **Baixa** (SkuOrigem).

### R-BC4.1 — Declarar a fronteira da Conexão de Canal *(documentação)*
- **Objetivo:** registrar oficialmente que `integration/infrastructure` (R2) + credenciais (R1) formam o contexto Conexão, com seus estados.
- **Escopo:** documentação; nenhum código.
- **Aceitação:** fronteira e estados documentados; nenhuma alteração de comportamento.
- **Rollback:** reverter o commit.
- **Estimativa:** **Baixa**.

### R-BC2.1 — Declarar a fronteira da Esteira *(documentação)*
- **Objetivo:** registrar o contexto núcleo (agentes A1→A10, veredito) e sua linguagem.
- **Escopo:** documentação.
- **Aceitação:** contexto e eventos documentados.
- **Rollback:** reverter.
- **Estimativa:** **Baixa**.

> **BC5, BC6, BC7 não geram release de código nesta fase:** BC5 depende do desbloqueio do
> Grupo C (validação operacional); BC6 e BC7 dependem de especificação de domínio/módulo.
> São **Epics de especificação**, não de implementação imediata.

---

## 14. Evidências insuficientes

- **BC3 Precificação** — contexto próprio × faceta de BC1: não decidível sem observar se o
  preço tem regras que mudam sem tocar o produto.
- **BC6 Vendas** — o **modelo interno** (Venda? Pedido? ambos?) não é observável; R5 nunca
  foi especificada.
- **"Cliente"** — um modelo ou dois (persona × registro): EVIDÊNCIA INSUFICIENTE.
- **"Imagem"** — contexto próprio × faceta de BC2: não decidível.
- **"Auditoria/Qualidade"** — contexto × faceta de BC2/BC1: não decidível.
- **Barramento de eventos** — os eventos são observáveis, mas **não publicados
  explicitamente**; sua formalização é hipótese, não fato.

---

## 15. Conclusão

O negócio do Zion OS revela, **por comportamento**, **sete regiões de domínio com
modelos próprios**:

1. **Catálogo de Produto** — o registro do que se vende.
2. **Esteira de IA** — o **núcleo**: gera o anúncio e julga sua qualidade.
3. **Precificação** — determina o preço *(ou faceta do Catálogo — em aberto)*.
4. **Conexão de Canal** — custodia o vínculo com o marketplace.
5. **Publicação no Canal** — o **hub**: converge tudo e publica.
6. **Vendas do Canal** — observa o resultado *(modelo ainda ausente)*.
7. **Identidade e Acesso** — atravessa todos *(módulo ainda ausente)*.

**Descoberta central:** a fronteira mais nítida do domínio é a que separa **o que a IA
produz** (Esteira, BC2) de **o que o canal publica** (Publicação, BC5). O termo "anúncio"
muda de dono exatamente nessa fronteira — é onde o Zion deixa de ser autor e o Mercado
Livre passa a ser autoridade. **Essa é a linha de corte natural do negócio**, e ela já está
parcialmente materializada nos módulos `publication` e `integration` criados pela
refatoração — não por desenho, mas porque **ambos seguiram o mesmo comportamento**.

**Dois contextos (BC6, BC7) existem por capacidade mas carecem de modelo** — são exatamente
as duas responsabilidades do **Grupo D** ("sem destino arquitetural"). Esta análise
**explica por que**: são regiões de negócio reais que a evolução do produto tornou
necessárias antes de terem sido modeladas. Não são lacunas de engenharia; são **fronteiras
de domínio aguardando especificação**.

> **A arquitetura implícita no negócio do Zion é uma linha de montagem:** produto entra
> (BC1), a IA o transforma (BC2), preparadores o enriquecem (BC3, medidas), o canal é
> conectado (BC4), tudo converge e publica (BC5), o resultado é observado (BC6) — sob um
> tenant identificado (BC7). Cada estação pode evoluir sozinha porque cada uma tem sua
> linguagem, seu ciclo e suas regras. **Esta é a base para a evolução incremental — descoberta,
> não imposta.**

---

*Produzido em 21 de julho de 2026 · `HEAD d2b0fe5` · sem alteração de código, arquitetura ou
governança.*
