import type { RepresentationRecord } from './record';

// Representation 001 — o Modelo de Representação: o conjunto dos fatos primários da Ontologia.
// Derivado DIRETAMENTE da Ontologia (P1/P4/D1/P2/D2/P6/D3); independente de formato e de implementação.
// Contém APENAS fatos primários; os derivados (Posição, Matéria, Espécie, Escopo, Completude) são
// reconstruídos pelo Compiler — nunca representados aqui.
//
// O AST é uma representação operacional compatível com o Representation Model.
// O Representation Model permanece a autoridade normativa; não depende do AST.
//
// INVARIANTES (Representation 001):
//   Fidelidade — carrega todos os fatos primários e nenhum outro (P3).
//   Determinismo — o conjunto é ordenável de forma total (por Símbolo).
//   Bidirecionalidade — o Símbolo é invariante sob grafia (P1); a projeção é reconstruível.
//   Imutabilidade Conceitual — representa conceitos; nunca cria conceito.
export type RepresentationModel = readonly RepresentationRecord[];
