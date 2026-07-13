// Port: ProdutoMestreRepository.
//
// A Application depende APENAS desta abstração — nunca de Supabase/banco. A
// implementação concreta é de Infra (PR futuro). O contrato canônico já vive no
// domínio (RepositorioProdutoMestre, um Port do domínio); aqui só o re-exportamos
// com o nome usado pela Application, mantendo UMA única fonte de verdade.

export type { RepositorioProdutoMestre as ProdutoMestreRepository } from "../../domain/produto-mestre/repositorio-produto-mestre.ts";
