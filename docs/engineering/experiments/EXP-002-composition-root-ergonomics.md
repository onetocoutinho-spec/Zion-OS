# EXP-002 — Experiment Design: Ergonomia do Composition Root

## Status

```
Status:                    Approved for Execution
Owner:                     Platform v2
Experiment:                EXP-002
Depends on:                EXP-001 — Pendências Fase 2
Produces evidence for:     Capability Kit v2
Last architectural review: 2026-07-24
```

> Segundo experimento da Platform v2. A hipótese mede carga cognitiva; as métricas apenas a observam.
>
> Este documento representa o desenho **aprovado antes da execução**. Ele não deve ser
> alterado durante o experimento — a evidência produzida é registrada separadamente.

---

## 1. Contexto

O Experimento 1 (commit `343f411`) respondeu a viabilidade **arquitetural** do composition root fino: plataforma byte-idêntica, AIL e comportamento idênticos — **parcialmente confirmada**, com o único desvio no critério 9 (simplicidade). A viabilidade está resolvida; **a nova pergunta é exclusivamente ergonômica** — avaliamos **carga cognitiva de integração**, não funcionamento. A v2 existe para **produzir evidência sobre quais partes da arquitetura precisam permanecer explícitas e quais são apenas cerimônia acidental.**

## 2. Hipótese

> **É possível eliminar a cerimônia ACIDENTAL do composition root fino, reduzindo a carga cognitiva que a superfície precisa carregar para integrar uma Capability, SEM esconder o que é essencial (o caminho `UserIntent → Decision → Capability` permanece visível e explicável na superfície), SEM introduzir abstração obrigatória, SEM comportamento implícito e SEM alterar a Platform.**

A hipótese trata de **compreensão**, não de tamanho. Uma solução de três linhas transparentes é superior a uma de uma linha implícita.

## 3. Hipótese nula

Falsa se qualquer redução da carga cognitiva exigir: **esconder** o essencial (§6); tornar a conveniência **obrigatória**; introduzir **comportamento implícito**; **alterar** a Platform; **aumentar acoplamento**; ou **piorar testabilidade**. *Se não der para reduzir a carga cognitiva preservando transparência, opcionalidade e zero mudança de plataforma.*

## 4. Variável independente

**A única variável:** a **forma como a superfície expressa a integração** — muda a ergonomia do call-site, **nunca o que acontece**. **Congelado (byte-idêntico):** Runtime · Mission · Shell · AIL · Capabilities · Adapters · serviços · PLAYBOOK. **Restrição dura:** qualquer candidato vive **fora** das camadas congeladas; se exigir tocar uma delas, **falha por definição** (Cenário C).

## 5. Atritos observados (classificação)

| Atrito | Classificação | Justificativa |
|---|---|---|
| Construção repetitiva do Runtime | **Acidental** | a relação entre os componentes é fixa; só varia qual Capability é injetada |
| `missionId` como string | **Acidental na forma · Essencial no núcleo** | roteamento é essencial; a string nua com falha silenciosa é encoding incidental |
| `ShellPort` vazio | **Desconhecido** | fronteira essencial (Lei 14) × instância vazia possivelmente acidental |

## 6. Análise da carga cognitiva *(evidência sobre o problema — sem soluções)*

| Elemento | Responsabilidade | Visível/conhecido na superfície? | Carga |
|---|---|---|---|
| **`runtime.receive(...)`** (o ato) | entrada que transforma intenção em Decisão+despacho (Lei 15) | **Sim** — ato essencial; ajuda a entender o fluxo | **Essencial** |
| **Runtime** (construção) | orquestrador | conceito sim; construção manual não acrescenta entendimento | **Acidental** (construção) |
| **DecisionFactory** | cria a Decision imutável | **Não** — interno da operação do Runtime | **Acidental** |
| **RuntimeDispatcher** | leva a Decision à CapabilityPort; publica eventos | **Não** — encanamento interno | **Acidental** |
| **Capability** (qual) | qual decisão de negócio trata o evento | **Sim** — o *quê*; núcleo do entendimento | **Essencial** |
| **Adapter** | fronteira de infra (Lei 16); reusa serviço + journal | **Indeterminado** — default sem config (Pendências) → cerimônia; alvo-no-construtor (Marketplace/Catalog) carrega info relevante | **Indeterminada** |
| **ShellPort** | fronteira Runtime→superfície (Lei 14) | **Indeterminado** — conceito essencial × instância vazia sem informação | **Indeterminada** |
| **UserIntent** | único artefato que a interface produz (Lei 13) | **Parcial** — `missionId`+`payload` essenciais; `type`/`timestamp` boilerplate | **Essencial (missionId+payload) · Acidental (type/timestamp)** |
| **`missionId`** | roteia a intenção à operação da Capability | **Sim** o roteamento; **não** a forma string nua | **Essencial (roteamento) · Acidental (forma)** |

**Síntese:** o essencial que a superfície precisa expor é **pequeno e nomeável** — *qual Capability · qual ação (missionId) · o payload · o ato de enviar ao Runtime*. A maior parte da cerimônia é **acidental** — *DecisionFactory, RuntimeDispatcher, a montagem do Runtime, o boilerplate `type`/`timestamp`*. **Dois** elementos são **indeterminados** — *Adapter* e *ShellPort*. Qualquer redução legítima deve **preservar o essencial** e só encapsular o acidental; os indeterminados exigem **escolha visível**, não default silencioso.

## 7. Hipóteses de redução *(consequência da análise — sem escolher vencedor)*

| Candidato | Carga acidental que elimina | Essencial que permanece visível | Implícito / Transparência / Acoplamento / Preserva? |
|---|---|---|---|
| **Factory de Kit** (monta o Runtime da Capability; a superfície chama `receive`) | Factory, Dispatcher, montagem | Capability · `receive` · UserIntent | sem implícito · transparência **preservada** · sem acoplamento · **preserva** |
| **Helper funcional** (recebe Capability+missionId+payload e dispara) | acima + boilerplate do UserIntent | Capability · missionId · payload | `type`/`timestamp` implícitos · Runtime some do call-site (**risco moderado**) · preserva o fluxo, menos visível |
| **Builder fluente** | pouca (tende a **adicionar** cerimônia) | tudo, verboso | sem implícito · **mais** cerimônia · over-engineering |
| **Composition helper** (liga → callable) | quase toda | quase nada | **muito implícito** · transparência **baixa** · **não preserva** a visibilidade |
| **Token de missão tipado** (a Capability exporta o `missionId`) | a forma-string mágica | roteamento **tipado** | sem implícito · transparência **melhora** · acoplamento leve/legítimo · preserva |
| **Default de `ShellPort`** | o port vazio | — | **risco de esconder a fronteira** de feedback · resolve o indeterminado **com** risco |

*(Candidatos podem se combinar. Nenhum é escolhido; a decisão sai da execução contra §8/§9.)* **Restrição §4:** variantes que defaultem a DecisionFactory/Dispatcher **dentro do construtor do Runtime** estão **descartadas** — tocariam a plataforma; a redução tem de ser invólucro de Kit.

## 8. Critérios objetivos de sucesso *(primárias decidem; secundárias só observam)*

**Evidências primárias — a hipótese; medem compreensão:**

- **Redução da carga cognitiva:** a superfície expõe apenas o essencial do §6 e nada de acidental além disso.
- **Preservação da arquitetura explícita:** o caminho `Runtime → Decision → Capability` continua **visível e explicável** na superfície.
- **Transparência:** nada mascarado.
- **Opcionalidade:** a conveniência é opcional; o composition root cru permanece válido.
- **Ausência de comportamento implícito:** falha não-silenciosa (ou silenciosa por **escolha visível**); sem defaults mágicos.
- **Zero alteração da Platform:** byte-idêntico.
- **Reprodutibilidade:** a mesma redução se aplica a uma **segunda superfície sem novo design**.

**Evidências secundárias — consequências observáveis; NÃO a hipótese:**

- Redução de código repetitivo.
- Redução aproximada do tamanho do call-site *(observada, nunca uma meta)*.
- Diminuição da cerimônia de construção.

> As primárias **decidem**. As secundárias são registradas como efeito e **jamais otimizadas em detrimento das primárias** — uma solução com menos linhas que fira qualquer primária é um **fracasso**.

## 9. Critérios objetivos de fracasso

- Abstração que **esconde responsabilidades** (o essencial do §6 deixa de ser visível).
- Abstração **difícil de explicar** (desloca a carga, não reduz).
- **Perda de transparência** (call-site mascara Runtime/AIL).
- **Necessidade de alterar** Runtime/Mission/Shell/AIL.
- **Aumento de acoplamento** (internals além dos contratos).
- Conveniência **obrigatória** (não coexiste com o composition root cru).
- **Comportamento implícito reintroduzido** (ex.: default de ShellPort que engole falhas).

## 10. Cenários possíveis

**A · Confirmada** — redução elimina a cerimônia acidental, mantém o essencial visível, é opcional, reprodutível, sem tocar a plataforma. → **v2:** o **Capability Kit v2 nasce** (padrão oficial recomendado, não obrigatório); o composition root cru permanece.

**B · Parcial** — parte da cerimônia some, mas um indeterminado (Adapter/ShellPort) resiste sem trade-off aceitável. → **v2:** Kit **parcial**; residuais viram itens abertos; padrão híbrido.

**C · Rejeitada** — nenhuma redução preserva a transparência sem virar abstração prematura, esconder a arquitetura ou tocar a plataforma. → **v2:** **nenhuma abstração adicional**; o composition root explícito **permanece o padrão oficial**; o atrito é aceito e documentado. **Resultado válido.**

## 11. Regra de decisão *(só evidência primária)*

Pergunta de encerramento: **"existe redução que elimina carga *acidental* (§6) preservando integralmente o *essencial* (§6) e satisfazendo TODAS as evidências primárias do §8 sem acionar NENHUM critério do §9?"**

- **Sim (A)** → **Capability Kit v2 deve nascer**, com o candidato que maximiza as primárias com menos opacidade (as secundárias só desempatam entre candidatos igualmente transparentes).
- **Sim, parcial (B)** → Kit **só** para o atrito resolvido; o resto permanece explícito.
- **Não (C)** → **o composition root atual permanece o padrão**; **nenhuma abstração adicional**.

**Guardrail:** a hipótese mede **compreensão**; as métricas medem **consequências** — **nunca o contrário**. Os §8/§9 protegem dos dois erros opostos: *over-engineering* (abstrair o essencial) e *under-serving* (aceitar cerimônia acidental por inércia).

## 12. Escopo do experimento

Este experimento avalia **exclusivamente a ergonomia da integração do ponto de vista do desenvolvedor.** Sua pergunta é: *"Quais partes do composition root representam conhecimento arquitetural essencial e quais representam apenas carga cognitiva acidental?"*

Consequentemente, este experimento **NÃO** produz evidência sobre: UX · UI · feedback visual · notificações · Mission UI · Feedback Layer · fluxo de interação do usuário · experiência da Capability durante sua execução · experiência percebida pelo usuário final.

Esses temas permanecem **deliberadamente fora do escopo** — decisão intencional. A Platform v2 ainda está consolidando seu **modelo oficial de integração Runtime ↔ superfície**; só após essa consolidação será iniciado um ciclo específico para investigar a **experiência do usuário** construída sobre essa arquitetura. Registrar este limite protege o experimento contra deriva de escopo e impede que decisões de UX influenciem um experimento cujo objetivo é **exclusivamente arquitetural**.

---

## Histórico

- v1 — desenho inicial
- v2 — inclusão da análise de carga cognitiva antes das soluções
- v3 — hipótese separada das métricas
- v4 — definição explícita do escopo
- vFinal — aprovado para execução
