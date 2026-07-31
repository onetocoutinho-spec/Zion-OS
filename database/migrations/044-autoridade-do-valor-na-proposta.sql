-- ============================================================
-- Zion OS — Migração 044: autoridade do valor na Proposal (INC-008)
--
-- INCREMENTAL. NÃO destrutiva. Uma coluna anulável, um CHECK, zero backfill.
--
-- ============================================================
-- O QUE ESTA COLUNA RESPONDE — E O QUE ELA NÃO RESPONDE
-- ============================================================
--
-- Responde: "de onde o Zion SABE que veio o valor que esta proposta congelou?"
--
-- NÃO responde: "quem autorizou a escrita?". Isso é `criada_por` aqui e
-- `origem`/`ator` em `procedencia_de_campo`, e os dois conceitos continuam
-- separados de propósito. Ver o INC-008: hoje `procedencia_de_campo.origem`
-- guarda AUTORIA DA AUTORIZAÇÃO, não fonte factual, e esta migração não
-- reinterpreta aquele campo.
--
--   AUTORIZAÇÃO NÃO É AUTORIDADE. O clique prova consentimento, não proveniência.
--
-- ============================================================
-- OS VALORES, e a semântica de cada um
-- ============================================================
--
--   derivado        O valor saiu de fonte autoritativa que já existia no
--                   domínio. Caso real: `preparar_resolucao` tira o peso das
--                   variantes irmãs via `pesoConhecidoDoProduto` — e NÃO lê
--                   `args`. A referência já viaja como precondição
--                   `pesoConhecido:<id>` desde o CICLO A.
--
--   calculado       O domínio computou deterministicamente a partir de fatos
--                   autorizados. Caso real: `precoParaMargem(margemAlvo, e)`,
--                   sobre custo e taxas lidos do banco.
--
--   sem_autoridade  O valor chegou como ARGUMENTO DO MODELO e não há vínculo
--                   demonstrável com uma fala do lojista nem com fonte do
--                   domínio. É o caso de `propor_gravacao` (individual e lote) e
--                   do ramo de preço de `propor_preco`.
--
--                   Isto NÃO é erro nem bloqueio. É o registro honesto de uma
--                   lacuna conhecida — ver a seção "não é gate" abaixo.
--
--   nao_se_aplica   A proposta não carrega um valor cuja proveniência esta
--                   taxonomia descreva. `titulo` é CONTEÚDO (um título é para
--                   ser composto; "quem disse este título?" não significa nada)
--                   e `cadastro` é IDENTIDADE (cria linha nova a partir da
--                   descrição da pessoa; não existe fonte anterior de onde
--                   derivar).
--
--                   Existe para que NULL não fique com dois significados. Sem
--                   ele, "título" e "proposta de 2026-07-30" seriam
--                   indistinguíveis, e a regra de legacy abaixo perderia o
--                   sentido.
--
--   ditado          O lojista forneceu o valor explicitamente, com PROVA
--                   determinística.
--
--                   ACEITO PELO CHECK E NUNCA PRODUZIDO PELO CÓDIGO DE HOJE.
--                   Nenhum fluxo atual consegue prová-lo: o turno é texto livre
--                   e o argumento vem do modelo. Marcar `ditado` porque uma
--                   ferramenta `propor_*` recebeu o argumento seria fabricar
--                   exatamente a autoridade que o INC-008 existe para não
--                   fabricar. Fica no CHECK para que o dia em que houver captura
--                   estruturada não precise de outra migração.
--
-- ============================================================
-- NULL É DESCONHECIDO HISTÓRICO — e só isso
-- ============================================================
--
-- SEM BACKFILL e SEM DEFAULT, de propósito.
--
-- Toda proposta criada antes desta migração fica `NULL`, e `NULL` significa
-- AUTORIDADE NÃO REGISTRADA. Não significa `derivado`, nem `calculado`, nem
-- `sem_autoridade`, nem `nao_se_aplica`, nem `ditado`.
--
-- Um DEFAULT transformaria silenciosamente linhas antigas em afirmações novas —
-- inventaria proveniência para propostas cuja proveniência ninguém observou. É a
-- mesma regra que já vale para `procedencia_de_campo`: ausência de linha
-- significa origem NÃO REGISTRADA, nunca origem inventada.
--
-- A proposta 903c1830-6cb3-488b-962f-c1edb018a60a é o caso concreto: `valor=410`,
-- compatível tanto com fala explícita quanto com derivação das irmãs (que pesam
-- 0.410 kg), e a conversa dela tem ZERO mensagens porque é da era do INC-004.
-- Nenhuma evidência persistida separa as hipóteses. Ela fica NULL.
--
-- ============================================================
-- ISTO NÃO É UM GATE
-- ============================================================
--
-- `sem_autoridade` NÃO impede execução, e esta migração não muda comportamento
-- nenhum. Expiração, ownership, status, precondições, reserva atômica e
-- confirmação humana seguem exatamente como estão.
--
-- Bloquear `sem_autoridade` só faria sentido junto de um mecanismo que capture
-- `ditado` — sem ele, o bloqueio derrubaria o caminho legítimo de quem dita um
-- peso. É decisão de produto posterior, não consequência desta coluna.
--
-- ============================================================
-- ROLLBACK LÓGICO
-- ============================================================
--
--   alter table public.copilot_propostas drop constraint if exists copilot_propostas_autoridade_valida;
--   alter table public.copilot_propostas drop column if exists autoridade;
--
-- Nada depende da coluna para funcionar: o código a lê como opcional. Derrubá-la
-- devolve o sistema ao estado anterior sem perda de dado operacional — perde-se
-- só a autoridade registrada desde aqui.
-- ============================================================

alter table public.copilot_propostas
  add column if not exists autoridade text;

-- `autoridade is null or ...` — o NULL passa por construção, então o CHECK pode
-- ser validado contra as linhas existentes sem nenhuma delas ser tocada.
alter table public.copilot_propostas
  drop constraint if exists copilot_propostas_autoridade_valida;

alter table public.copilot_propostas
  add constraint copilot_propostas_autoridade_valida
  check (
    autoridade is null
    or autoridade in ('derivado', 'calculado', 'sem_autoridade', 'nao_se_aplica', 'ditado')
  );

comment on column public.copilot_propostas.autoridade is
  'De onde o Zion sabe que veio o valor congelado nesta proposta. NULL = autoridade nao registrada (proposta anterior a 044) e NUNCA deve ser lido como uma das classes. "ditado" e aceito pelo CHECK e nao e produzido por nenhum fluxo atual. Nao confundir com autoria da autorizacao (criada_por / procedencia_de_campo.origem). Ver INC-008.';

-- ---------- a prova ----------

do $$
declare
  antigas_nao_nulas int;
  tem_default       int;
begin
  -- Nenhuma linha anterior pode ter ganhado valor.
  select count(*) into antigas_nao_nulas
    from public.copilot_propostas
   where autoridade is not null;

  if antigas_nao_nulas > 0 then
    raise exception
      'MIGRACAO 044: % proposta(s) antiga(s) ficaram com autoridade preenchida. Backfill nao foi autorizado.',
      antigas_nao_nulas;
  end if;

  -- Nenhum DEFAULT pode existir: ele transformaria a proxima linha antiga
  -- reescrita, ou qualquer insert legado, numa afirmacao que ninguem observou.
  select count(*) into tem_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'copilot_propostas'
     and column_name  = 'autoridade'
     and column_default is not null;

  if tem_default > 0 then
    raise exception 'MIGRACAO 044: a coluna autoridade ganhou DEFAULT. NULL precisa continuar sendo desconhecido.';
  end if;

  raise notice '044 conferida: coluna anulavel, sem default, % proposta(s) antiga(s) intactas em NULL.',
    (select count(*) from public.copilot_propostas);
end $$;

-- ---------- a regra da 043, exercida por esta migração ----------

insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)
values ('044', '044-autoridade-do-valor-na-proposta', now(),
        'coluna autoridade anulavel em copilot_propostas; sem backfill, sem default, sem RLS; NULL = nao registrada; nao e gate de execucao')
on conflict do nothing;

-- ============================================================
-- Conferência
-- ============================================================
-- select autoridade, count(*) from public.copilot_propostas group by 1;
-- Esperado logo apos aplicar: uma linha, autoridade NULL, com a contagem atual.
