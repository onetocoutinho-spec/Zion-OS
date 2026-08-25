// Quanto o catálogo de ferramentas PESA em cada chamada ao modelo — e quanto
// o roteamento por especialista economiza.
//
// Rodar: npx tsx scripts/medicoes/tamanhoDoCatalogo.ts
//
// A conta é sobre o JSON que vai para a API (nome + descrição + schema), que é
// exatamente o que atravessa em TODA chamada. A estimativa de tokens é
// chars/4 — grosseira de propósito: o que decide aqui é a ORDEM de grandeza e
// a diferença relativa, não o número exato.

import { FERRAMENTAS } from "../../src/modules/assistant/domain/ferramentasDoAssistente";
import {
  DEFINICOES,
  ferramentasDoEspecialista,
  type Especialista,
} from "../../src/modules/assistant/domain/especialistas";

const tamanho = (fs: readonly { nome: string; descricao: string; parametros: unknown }[]) =>
  JSON.stringify(
    fs.map((f) => ({ name: f.nome, description: f.descricao, input_schema: f.parametros }))
  ).length;

const total = tamanho(FERRAMENTAS);
console.log(
  `CATÁLOGO INTEIRO: ${FERRAMENTAS.length} ferramentas · ${total} chars · ~${Math.round(total / 4)} tokens`
);
console.log("");

const declaradas = new Set<string>();
for (const nome of Object.keys(DEFINICOES) as Especialista[]) {
  const fs = ferramentasDoEspecialista(nome, FERRAMENTAS);
  const t = tamanho(fs);
  // O `geral` leva TODAS por definição — incluí-lo aqui mascararia justamente
  // a ferramenta que nenhum especialista declara.
  if (nome !== "geral") for (const f of fs) declaradas.add(f.nome);
  const economia = Math.round((1 - t / total) * 100);
  console.log(
    `${nome.padEnd(12)} ${String(fs.length).padStart(2)} ferr · ${String(t).padStart(6)} chars · ~${String(
      Math.round(t / 4)
    ).padStart(5)} tokens · economia ${String(economia).padStart(3)}%`
  );
}

console.log("");
const orfas = FERRAMENTAS.map((f) => f.nome).filter((n) => !declaradas.has(n));
console.log(
  "INALCANÇÁVEIS fora do especialista 'geral':",
  orfas.length ? orfas.join(", ") : "nenhuma"
);
