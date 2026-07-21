# Módulos

Espaço da organização por **módulo de domínio**, conforme a arquitetura oficial do
Zion OS.

Cada subdiretório corresponde a um módulo que **possui uma verdade de negócio** e a
protege. Módulos colaboram **apenas por fatos publicados e referências por identidade** —
nenhum alcança o interior de outro.

## Camadas, dentro de cada módulo

- **`domain/`** — a verdade e suas invariantes. **Não depende de nada.**
- **`application/`** — casos de uso; orquestram, não contêm regra de negócio.
- **`ports/`** — o que o domínio declara precisar.
- **`adapters/`** — fronteiras de entrada e saída (observadores, publicadores,
  tradutores quando aplicável).
- **`infrastructure/`** — realização técnica das portas; serve o domínio, nunca o governa.

Direção das dependências: `adapters → application → domain`, e `infrastructure → domain`.

## Estado

Estrutura criada pela **Etapa 1** do Plano de Refatoração Arquitetural. **Nenhuma
responsabilidade foi migrada ainda.** As migrações ocorrem nas etapas seguintes.

Referência: `docs/zion-os/organization/` e `docs/zion-os/modules/`.
