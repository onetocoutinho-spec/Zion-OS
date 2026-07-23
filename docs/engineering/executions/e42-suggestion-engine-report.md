# Evolution Report — E4.2 · Suggestion Engine (R-SE-1)

> Capítulo III — Decision Intelligence · a primeira capability ATIVA da AIL.
> O sistema oferece — e assina. Continua sem decidir, sem aprender, sem delegar.

## O que foi construído

- **Elegibilidade** (`veredictoElegibilidade`): o contrato PD-001/RFC-AIL-005
  §6.1 implementado SEM regra adicional — `consistente` ∧ slot `CONSISTENTE` ∧
  sem disputa ∧ evidências deriváveis ∧ registro de oferta disponível. Todo
  silêncio devolve o motivo citável.
- **Registro de Ofertas** (migração **025**, tabela `ofertas`): a ADR-001
  materializada. Append-only, OfferId do domínio (R-INF-001), base **congelada
  no instante** (confidence/ocorrências do momento — a projeção evolui, a
  auditoria não), **assinada** (`autor_da_oferta = 'suggestion-engine'` — o
  sistema passa a assinar o que oferece: metade da lacuna S-30 fechada),
  versão do contrato e origem da explicação gravadas.
- **O fato antes da fala**: `gerarSugestao` registra a Oferta ANTES de devolver
  a Sugestao; se o registro falhar, **não há sugestão** — uma oferta
  não-auditável não pode existir (ADR-001). Nenhuma falha propaga ao formulário.
- **UX** (`MemoriaContextual`, agora N1+N2): só o campo **VAZIO** recebe
  pré-preenchimento (Lei da Abstenção); valor editável, removível ("Remover
  sugestão") e substituível; **uma oferta por montagem** — remover não
  re-oferece (nunca insistir); origem, confidence, motivo de elegibilidade e
  evidências sempre visíveis; "a decisão é sua" permanece no idioma.
- **Outcome Readiness** (Parte 6): nenhum Outcome é calculado. A identidade da
  oferta (slot + entidade + valor + instante + correlação) é suficiente para a
  futura projeção `Outcomes = f(ofertas × Journal)` responder
  aceita/editada/ignorada/rejeitada.

## Estado em produção — o Engine nasce em silêncio

0 Patterns `consistente` existem hoje → **nenhuma oferta será gerada** até a
memória amadurecer. Não é limitação: é o critério de elegibilidade funcionando
antes da primeira sugestão (PD-001). O primeiro slot a graduar provavelmente
será `catalogo/categoriaMarketplace` (duas fontes convergentes).

## Auditoria (Parte 7) — verificada por teste

Toda Sugestao tem Pattern, Confidence preservada, explicação derivada e Oferta
registrada (o `offerId` viaja na própria Sugestao); toda Oferta é reconstruível
(fatos congelados + projeções confluentes); nenhuma Oferta toca o Journal, o
Detector ou a captura (módulos intocados — diff não contém uma linha deles);
silêncio não registra oferta.

## Performance (Parte 8)

Geração usa só projeções (matching E4.1) + 1 INSERT append-only; zero
recomputação (confidence exibida = materializada, provado em teste); a única
persistência nova é o próprio fato-da-oferta (exigência da ADR-001, não
duplicação — nenhum dado do Pattern é copiado exceto o que precisa ser
congelado para auditoria); zero impacto na captura (fluxo de save inalterado).

## Dinâmica registrada para o ciclo de Outcomes

Aceitar a sugestão e salvar gera (no update com delta) uma Decision normal —
que o Detector contará como suporte. Quando a projeção de Outcomes existir,
ela deverá reconhecer essa Decision como **confirmada** da oferta
correspondente (via slot+entidade+instante) para não tratar auto-reforço como
correção espontânea. Registrado aqui como insumo do design da projeção — não é
bug atual (Confidence acima de consistente ainda não é calculada).

## O que aprendemos sobre oferecer conhecimento

Que ofertar é 90% auditoria e 10% UI: o valor sugerido é uma linha; o fato
assinado, congelado e reconstruível é o resto. E que o "fato antes da fala"
inverte a arquitetura usual de sugestões — aqui a sugestão é *consequência* do
registro, nunca o contrário.

## O que aprendemos sobre auditabilidade de sugestões

Que congelar a base no instante (`confidence_utilizada`,
`ocorrencias_no_momento`) é o que separa auditoria de projeção: a pergunta
futura não é "o que o Pattern diz hoje?", é "**o que o operador viu quando
decidiu?**".

## O que aprendemos sobre a diferença entre informar e sugerir

Que ela cabe numa preposição: informar fala **sobre** o campo; sugerir escreve
**no** campo — e por isso só sugerir exige fato registrado, assinatura e
contrato de elegibilidade. A fronteira desenhada no E4.1 aguentou exatamente
como prevista.

## Organizational Knowledge Added

| Descoberta | Evidência | Impacto |
|---|---|---|
| O fato antes da fala | registro→sugestão; falha→silêncio (testado) | padrão para toda capability ativa futura |
| O sistema agora assina o que oferece | `autor_da_oferta` em toda oferta | metade da S-30 fechada; Artigo VIII avança |
| Base congelada ≠ projeção viva | `confidence_utilizada` no instante | contrato da futura projeção de Outcomes |
| Auto-reforço identificado antes de existir | dinâmica aceitar→Decision→suporte | insumo obrigatório do design de Outcomes |

## Reflection

**Em que momento uma memória deixa de ser conhecimento e passa a ser
responsabilidade do sistema?** A evidência desta release responde com precisão
cirúrgica: **no instante em que o sistema escreve o valor no campo.** Até ali,
tudo era leitura — o Browser revelava, a Memória Contextual informava, e a
responsabilidade era inteira do operador que lia. Ao pré-preencher, o sistema
pratica um ato — e o programa inteiro convergiu para exigir o que se exige de
qualquer ato com autoridade emprestada (PR-011): **assinatura** (autor da
oferta), **escopo** (só o vazio, só o elegível), **rastro imutável** (o fato
append-only) e **reversibilidade** (remover, editar, substituir). A resposta,
portanto, já estava na Constituição antes do Engine existir: conhecimento vira
responsabilidade quando vira **ato** — e um ato sem assinatura, na Zion, não
tem permissão para acontecer.
