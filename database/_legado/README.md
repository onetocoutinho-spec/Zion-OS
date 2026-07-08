# Scripts legados (setup antigo v1.x)

Estes SQLs eram o setup do banco **antes** da adoção das migrações numeradas.
Ficam aqui só como **histórico** — **não rode** em uma instalação nova.

A fonte da verdade atual é **`database/migrations/`** (001…011, em ordem).

| Arquivo | Era |
| --- | --- |
| `supabase-schema.sql` | tabelas/índices/triggers iniciais |
| `supabase-rls.sql` | RLS inicial |
| `supabase-realtime.sql` | habilitava o realtime |
| `supabase-setup-completo.sql` | setup tudo-em-um |
| `supabase-migracao-v1.4.sql` | coluna `tipo` no histórico de execuções |
| `seed.sql` | dados de demonstração |
