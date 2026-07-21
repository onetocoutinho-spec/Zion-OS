# Operation Center — Especificação Arquitetural (v0)

> **Natureza deste documento.** Fundação de produto. Define **o que** o módulo é
> antes de qualquer decisão de UX, backend, IA ou integração. Não há telas,
> componentes, framework nem schema aqui — de propósito. Tudo o que vier depois
> (UX, API, modelo de dados, agentes de IA) deve poder ser justificado por uma
> linha deste documento.
>
> **Tese central.** O Operation Center não é uma "tela de gestão". É o **plano de
> controle** da operação de e-commerce da Zion: transforma trabalho fragmentado
> (importar, otimizar, publicar, corrigir, monitorar, espalhado por dezenas de
> telas e dois painéis) em um **fluxo priorizado, guiado e assistido por IA**,
> operável em escala sobre muitos clientes e canais.

---

## Princípios de arquitetura (guardas de todas as decisões futuras)

1. **É um SO de operação, não um CRUD.** A unidade não é "registro", é **missão**
   (trabalho a fazer, com prioridade e contexto).
2. **Loop operacional único:** `Sinal → Missão → Execução assistida → Resultado → Indicador`.
   Tudo no módulo é uma instância desse loop.
3. **Orquestrador, não executor.** O Operation Center **decide e coordena**; a
   execução vive nos módulos donos (Publicação fala com o ML, Catálogo é dono do
   produto). O OC **nunca** chama a API do Mercado Livre diretamente.
4. **Agency-operated, human-in-the-loop.** Na fundação, quem opera é o **operador
   da Zion**, assistido por **uma IA única** (nunca "agentes A0–A12" expostos).
5. **Multi-tenant e multi-canal por construção** — mesmo que a v1 rode 1 canal.
6. **Event-driven.** O estado do OC é derivado de **eventos** dos outros módulos;
   ele reage a fatos, não faz polling de telas.
7. **Auditável por padrão.** Toda missão e ação registra quem/o quê/quando/resultado.

---

## 1. Missão do Operation Center

**Ser o único lugar onde a operação de e-commerce de todos os clientes é vista,
priorizada e conduzida — convertendo operação reativa e fragmentada em operação
proativa, priorizada e assistida.**

Em uma frase de valor: *fazer com que um operador da Zion consiga rodar a operação
de dezenas de lojistas com clareza do que importa agora, sem pular entre telas,
logins e conhecimento preso em pessoas.*

O OC responde continuamente a três perguntas:
- **Como está** a operação (de cada cliente, canal, produto, anúncio)?
- **O que fazer agora** e por quê (priorização)?
- **Como fazer** com o mínimo de atrito (execução guiada + IA)?

---

## 2. Problemas que ele resolve

Baseado na dor real observada na operação do piloto (Chinelaria) e no handoff:

| Problema atual | Como o OC ataca |
|---|---|
| **Fragmentação** — trabalho espalhado por ~20 itens de menu, dois painéis duplicados | Um cockpit por operação; o trabalho vira **fila de missões**, não navegação |
| **Sem priorização** — o operador não sabe o que fazer primeiro | Missões priorizadas por impacto/SLA/estado |
| **Estado invisível** — não se sabe o que está no ar, bloqueado ou parado | Visão de **estado e saúde** consolidada por cliente/canal |
| **Reatividade** — problema só aparece quando o cliente reclama | **Sinais proativos** (sem estoque, preço fora, anúncio pausado, publish falho) |
| **Não escala** — cada cliente exige trabalho manual repetido | **Orquestração multi-cliente** e assistência de IA |
| **Conhecimento heroico** — "só fulano sabe publicar" | Missões com **execução explícita e guiada** |
| **Agentes crus expostos** — A0–A12 na cara do usuário | IA **única e invisível** embutida nas missões |

---

## 3. Perfil dos usuários

- **Operador Zion (persona primária).** Toca a operação de vários clientes:
  importa, otimiza, publica, corrige, monitora. **Não é técnico.** Quer saber o
  que fazer agora e executar sem fricção. Sucesso = mais operação boa por dia.
- **Líder/Supervisor de operação.** Vê saúde geral, gargalos, produtividade,
  aprova exceções e redistribui carga. Sucesso = throughput e qualidade da equipe.
- **IA (usuário não-humano).** Detecta sinais, propõe e prioriza missões, executa
  passos e explica. É assistente, não caixa-preta.
- **Cliente lojista (persona periférica na fundação).** Destinatário do resultado;
  na v1 tem visão majoritariamente **read** da própria operação — **não opera**
  diretamente (ver §14).

---

## 4. Objetivos de negócio

1. **Alavancagem da agência** — aumentar nº de clientes atendidos por operador.
2. **Time-to-publish** — reduzir o tempo do produto recebido até o anúncio no ar.
3. **Cobertura de catálogo** — aumentar o % do catálogo do cliente efetivamente
   publicado e saudável.
4. **Qualidade** — reduzir falhas de publicação e retrabalho.
5. **Retenção** — resultado visível e consistente → o lojista permanece.
6. **Padronização** — reduzir dependência de heróis; operação repetível.

---

## 5. Capacidades do módulo

Capacidades (o que o módulo **faz**), independentes de tela:

- **Consolidar estado** de todas as operações (cliente × canal × produto × anúncio).
- **Detectar sinais** proativos que exigem atenção.
- **Priorizar** o trabalho como fila de missões (impacto × urgência × SLA).
- **Guiar a execução** de cada missão, com IA embutida.
- **Orquestrar ações** sobre os canais (publicar, republicar, corrigir, pausar) —
  **via os módulos donos**, nunca direto.
- **Registrar e auditar** cada missão e ação.
- **Medir** a operação (indicadores).
- **Operar em escala** multi-cliente e multi-canal.

---

## 6. Domínios envolvidos

Distinguindo o que o OC **possui** do que **consome** (fronteiras de contexto):

| Domínio | Relação | Papel |
|---|---|---|
| **Operação** | 🟢 Owned | Estado operacional consolidado e saúde |
| **Missão** | 🟢 Owned | Unidade de trabalho priorizável |
| **Sinal** | 🟢 Owned | Fato observado que pode gerar missão |
| **Produto / Catálogo** | 🔵 Consumed | O que se vende (dono: Catálogo) |
| **Anúncio / Publicação** | 🔵 Consumed | Materialização no canal (dono: Publicação) |
| **Canal / Integrações** | 🔵 Consumed | Conexão com marketplaces (dono: Integrações) |
| **Cliente / Tenancy** | 🔵 Consumed | De quem é a operação e limites de acesso |
| **IA / Assistência** | 🔵 Consumed | O agente único |
| **Identidade / Autorização** | 🔵 Consumed | Quem pode operar o quê |

**Regra de fronteira:** o OC é dono de **Operação, Missão e Sinal**. Todo o resto
ele **referencia**, nunca duplica nem executa.

---

## 7. Entidades principais

Descritas por propósito e ciclo de vida (sem schema):

- **Operação** *(raiz de agregação)* — a operação de um cliente em um canal (e a
  visão consolidada). Carrega estado e saúde; é o "sujeito" do módulo.
- **Missão** — unidade de trabalho. Tem **tipo** (publicar, corrigir, reconectar,
  onboarding…), **prioridade**, **estado** (pendente → em execução → concluída /
  falha / descartada), **alvo** (produto/anúncio/canal), **origem** (sinal, IA ou
  humano) e **SLA**.
- **Sinal** — fato observado (ex.: anúncio pausado, sem estoque, publish falhou,
  catálogo incompleto, canal expirado). É a **fonte** da maioria das missões.
- **Produto (ref)**, **Anúncio (ref)**, **Canal (ref)** — referências a entidades
  de outros domínios; o OC guarda o vínculo e o estado observado, não a verdade.
- **Ação** — um comando emitido pelo OC a um módulo dono (ex.: "publicar"),
  com resultado rastreável.
- **Registro operacional / Auditoria** — histórico imutável de missões e ações.
- **Indicador** — métrica materializada da operação.

---

## 8. Eventos produzidos e consumidos

O contrato de integração do módulo (fundação para o backend):

**Consome (de outros módulos):**
- `ProdutoImportado`, `ProdutoAtualizado`, `CatalogoIncompleto` *(Catálogo)*
- `AnuncioPublicado`, `AnuncioFalhou`, `AnuncioPausado`, `AnuncioAtualizado` *(Publicação)*
- `CanalConectado`, `CanalExpirado` *(Integrações)*
- `EstoqueMudou`, `PrecoMudou` *(ERP/Canal)*

**Produz:**
- `SinalDetectado`
- `MissaoCriada`, `MissaoPriorizada`, `MissaoIniciada`, `MissaoConcluida`,
  `MissaoFalhou`, `MissaoDescartada`
- `AcaoSolicitada` (publicar / republicar / corrigir / pausar) — **consumida pelos
  módulos donos**, que executam
- `OperacaoAtualizada` (estado / saúde)

Esse conjunto define o acoplamento **por eventos**: o OC não "chama telas", ele
reage a fatos e emite intenções.

---

## 9. Relação com os demais módulos do Zion OS

- **Catálogo/Produto** — OC consome o estado do catálogo e **aciona**
  enriquecimento (via IA/esteira) como parte de missões; não é dono do produto.
- **Publicação/Anúncio** — OC **orquestra** publish/republish e consome o
  resultado. *A idempotência das Size Charts entregue na Sprint 0 vive aqui, sob
  Publicação;* o OC apenas dispara a intenção e observa o desfecho.
- **Integrações/Canal** — OC lê a saúde da conexão e reage a `CanalExpirado`;
  **nunca** fala com o Mercado Livre diretamente.
- **IA (agente único)** — OC é o principal consumidor: a IA sugere/prioriza
  missões, executa passos e explica. Os "agentes" ficam **invisíveis** atrás dela.
- **Tenancy/Identidade** — OC opera estritamente dentro da autorização por cliente.
- **Esteira de anúncio** — capacidade de Produto/IA que o OC **aciona**; não a
  reimplementa.

**Invariante de arquitetura:** o OC **orquestra e observa**; a **execução** e a
**verdade** vivem nos módulos donos.

---

## 10. Fluxo operacional completo de um dia

Um operador da Zion, do login ao fim do expediente:

1. **Abre o Operation Center.** Vê a **saúde consolidada** de todos os seus
   clientes: quantos anúncios saudáveis, quantos sinais abertos, quais operações
   estão "no vermelho".
2. **Encara a fila de missões**, já priorizada. No topo:
   *"Chinelaria — 12 produtos prontos para publicar (impacto alto)."*
3. **Entra na missão.** A IA guia: valida ficha/medidas, mostra o que será
   publicado, sinaliza pendências. O operador confirma.
4. **Executa.** O OC emite `AcaoSolicitada: publicar` → **Publicação** executa
   (search-before-create idempotente, GET rows, createItem). O resultado retorna
   como `AnuncioPublicado`/`AnuncioFalhou`.
5. **Resultado vira sinal/indicador.** Sucesso atualiza a cobertura de catálogo;
   falha gera novo **sinal** → nova **missão** priorizada.
6. **Próxima missão:** *"3 anúncios pausados por falta de estoque."* A IA propõe a
   correção; o operador aprova; o OC orquestra.
7. **Exceção:** *"Canal do Cliente X expirou (OAuth)."* Missão de **reconexão**
   entra no topo por bloquear tudo daquele cliente.
8. **Fim do dia:** indicadores atualizados (missões concluídas, time-to-publish,
   backlog residual). O supervisor vê a saúde da equipe e redistribui o que sobrou.

O dia inteiro é o mesmo loop: **Sinal → Missão → Execução assistida → Resultado → Indicador.**

---

## 11. Indicadores críticos

- **Time-to-publish** — recebido → no ar (mediana e p90).
- **Cobertura de catálogo publicado** — % do catálogo do cliente saudável no canal.
- **Throughput** — missões concluídas por operador/dia.
- **Taxa de sucesso de publicação** — 1 − falhas.
- **Backlog de missões** — volume, idade média e **SLA estourado**.
- **MTTR de sinais** — tempo para resolver um problema detectado.
- **Saúde de anúncios** — ativos vs pausados vs incompletos.
- **Alavancagem** — clientes ativos por operador.

---

## 12. Casos de uso

- **UC1 — Publicar catálogo novo** de um cliente (fluxo User Products). *Gatilho:*
  `ProdutoImportado` em lote. *Resultado:* anúncios no ar + cobertura ↑.
- **UC2 — Corrigir anúncios pausados por estoque.** *Gatilho:* `AnuncioPausado` /
  `EstoqueMudou`. *Resultado:* anúncio reativado.
- **UC3 — Reagir a falha de publicação** com retry idempotente (reusa a guia).
  *Gatilho:* `AnuncioFalhou`. *Resultado:* republicação sem duplicar guia.
- **UC4 — Onboarding de novo cliente** (conectar canal → importar → primeira leva).
- **UC5 — Atualização de preço/estoque em massa.** *Gatilho:* `PrecoMudou`.
- **UC6 — Reconexão de canal expirado** (OAuth). *Gatilho:* `CanalExpirado`.
- **UC7 — Supervisão:** ver saúde da equipe, gargalos e redistribuir missões.

---

## 13. Limites do módulo

O Operation Center **não é**:
- **o Catálogo** — não é dono do produto (só referencia).
- **a camada de integração** — não fala com o Mercado Livre diretamente.
- **a esteira de IA** — aciona a IA, não a implementa.
- **ERP / financeiro** — não gere compras, fiscal ou fluxo de caixa.
- **o portal do cliente** — pode alimentá-lo, mas não é ele.
- **um executor** — orquestra e observa; a execução vive nos módulos donos.

---

## 14. Fora do escopo da primeira versão (deliberado)

- **Multi-marketplace** — v1 só Mercado Livre; Shopee/Amazon/Magalu depois.
- **Cliente operando diretamente** — v1 é agency-operated; portal do cliente é read.
- **Automação total sem humano** — v1 é human-in-the-loop assistido.
- **Repricer / precificação dinâmica** — fora.
- **Previsão de demanda / sugestão de compras** — fora.
- **Operação de anúncios/guias legadas não-Zion** — fora (liga com o backlog da
  Sprint 0: compatibilidade com guias legadas).
- **Billing por missão / SLA contratual automatizado** — fora.
- **App mobile** — fora.

---

## Fronteira com a Sprint 0 (continuidade)

A Sprint 0 entregou a **fundação de execução** de Publicação (idempotência de Size
Charts, SIZE_GRID_ROW_ID, OAuth). O Operation Center é a camada **acima**: ele não
reescreve nada disso — ele **orquestra** essa execução dentro de missões e a torna
visível, priorizada e assistida. Esta especificação é a base para os próximos
documentos de UX, backend, IA e integrações do módulo.
